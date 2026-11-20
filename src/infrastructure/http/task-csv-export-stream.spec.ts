import { describe, expect, it, vi } from 'vitest';

import { readTaskCsvExport, TASK_CSV_NDJSON } from './task-csv-export-stream.js';

const encoder = new TextEncoder();
const metadata = { kind: 'metadata', filename: 'liste.csv', header: '"Échéance"' };
const row = {
  kind: 'row',
  row: {
    beforeAssignees: ['"CAD-482"', '"Écouter 🥐"', '"En cours"', '"Haute"'],
    assigneeIds: ['019a5f3c-8d2e-7c4a-9b1f-3e5d7a9c1b30'],
    afterAssignees: ['"2026-11-12"', '""'],
  },
};
const complete = { kind: 'complete', rowCount: 1 };
const upstreamFailure = {
  problem: { status: 503, code: 'upstream.failed', details: { service: 'task-service' } },
};

/** Builds the byte representation of one or more records with all delimiters present. */
function ndjson(...records: unknown[]): string {
  return records.map((record) => `${JSON.stringify(record)}\n`).join('');
}

/** Gives the decoder an internal success response with the negotiated content type. */
function response(body: BodyInit, mediaType = TASK_CSV_NDJSON): Response {
  return new Response(body, { headers: { 'Content-Type': mediaType } });
}

/** Collects the small test streams so their complete record sequence can be asserted. */
async function collect<T>(stream: AsyncIterable<T>): Promise<T[]> {
  const records: T[] = [];
  for await (const record of stream) records.push(record);
  return records;
}

describe('Task CSV export stream', () => {
  it('reads split UTF-8 records and preserves their content', async () => {
    const bytes = encoder.encode(ndjson(metadata, row, complete));
    const body = new ReadableStream<Uint8Array>({
      start(stream) {
        for (const byte of bytes) stream.enqueue(Uint8Array.of(byte));
        stream.close();
      },
    });

    const records = readTaskCsvExport(response(body, 'application/x-ndjson; charset="UTF-8"'));

    await expect(collect(records)).resolves.toEqual([metadata, row, complete]);
  });

  it.each([
    ['missing metadata', ndjson(row, complete)],
    ['duplicate metadata', ndjson(metadata, metadata, row, complete)],
    ['missing completion', ndjson(metadata, row)],
    ['missing final LF', ndjson(metadata, row, complete).trimEnd()],
    ['mismatched row count', ndjson(metadata, row, { ...complete, rowCount: 0 })],
    ['trailing frame', ndjson(metadata, row, complete, row)],
    ['trailing byte', `${ndjson(metadata, row, complete)} `],
    ['malformed JSON', `${ndjson(metadata)}{oops}\n`],
    ['malformed UTF-8', new Uint8Array([0xc3, 0x0a])],
    ['a UTF-8 BOM', `\uFEFF${ndjson(metadata, row, complete)}`],
    ['unrecognized metadata fields', ndjson({ ...metadata, secret: 'rejected' }, row, complete)],
    ['unrecognized row fields', ndjson(metadata, { ...row, secret: 'rejected' }, complete)],
    [
      'unrecognized projection row fields',
      ndjson(metadata, { ...row, row: { ...row.row, secret: 'rejected' } }, complete),
    ],
    ['unrecognized completion fields', ndjson(metadata, row, { ...complete, secret: 'rejected' })],
    [
      'malformed assignee UUID',
      ndjson(metadata, { ...row, row: { ...row.row, assigneeIds: ['not-a-uuid'] } }, complete),
    ],
    [
      'duplicate assignees with different UUID casing',
      ndjson(
        metadata,
        {
          ...row,
          row: {
            ...row.row,
            assigneeIds: [
              ...row.row.assigneeIds,
              ...row.row.assigneeIds.map((id) => id.toUpperCase()),
            ],
          },
        },
        complete,
      ),
    ],
  ])('refuses %s', async (_label, body) => {
    await expect(collect(readTaskCsvExport(response(body)))).rejects.toMatchObject(upstreamFailure);
  });

  it('includes the terminator in the byte limit and releases an oversized stream', async () => {
    const maxRecordBytes = 128 * 1024;
    const emptyHeaderBytes = ndjson({ ...metadata, header: '' }).length;
    const header = 'a'.repeat(maxRecordBytes - emptyHeaderBytes);
    const atLimit = { ...metadata, header };
    const done = { kind: 'complete', rowCount: 0 };
    await expect(collect(readTaskCsvExport(response(ndjson(atLimit, done))))).resolves.toEqual([
      atLimit,
      done,
    ]);

    const cancel = vi.fn();
    const oversized = new ReadableStream<Uint8Array>({
      start(stream) {
        stream.enqueue(encoder.encode(ndjson({ ...atLimit, header: `${header}a` })));
      },
      cancel,
    });
    await expect(collect(readTaskCsvExport(response(oversized)))).rejects.toMatchObject(
      upstreamFailure,
    );
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('enforces the row limit while consuming valid individual rows', async () => {
    const encodedRow = encoder.encode(ndjson(row));
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      start(stream) {
        stream.enqueue(encoder.encode(ndjson(metadata)));
      },
      pull(stream) {
        stream.enqueue(encodedRow);
      },
      cancel,
    });
    let rows = 0;

    async function consume(): Promise<void> {
      for await (const record of readTaskCsvExport(response(body))) {
        if (record.kind === 'row') rows += 1;
      }
    }

    await expect(consume()).rejects.toMatchObject(upstreamFailure);
    expect(rows).toBe(10_000);
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('waits for clean EOF before yielding completion', async () => {
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    const writer = writable.getWriter();
    const iterator = readTaskCsvExport(response(readable))[Symbol.asyncIterator]();
    const writing = writer.write(encoder.encode(ndjson(metadata, row, complete)));
    await expect(iterator.next()).resolves.toMatchObject({ value: metadata, done: false });
    await expect(iterator.next()).resolves.toMatchObject({ value: row, done: false });
    await writing;
    const finished = vi.fn();
    const pending = iterator.next().then((result: IteratorResult<unknown>) => {
      finished();
      return result;
    });
    await Promise.resolve();
    expect(finished).not.toHaveBeenCalled();

    await writer.close();
    await expect(pending).resolves.toEqual({ value: complete, done: false });
    await expect(iterator.next()).resolves.toMatchObject({ done: true });
  });

  it('cancels the upstream stream when the consumer stops early', async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      start(stream) {
        stream.enqueue(encoder.encode(ndjson(metadata)));
      },
      cancel,
    });
    for await (const record of readTaskCsvExport(response(body))) {
      expect(record).toEqual(metadata);
      break;
    }
    expect(cancel).toHaveBeenCalledOnce();
    expect(body.locked).toBe(false);
  });

  it('cancels a stalled body when the caller aborts', async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({ cancel });
    const abort = new AbortController();
    const reason = new Error('cancelled by the caller');
    const pending = collect(readTaskCsvExport(response(body), abort.signal));

    abort.abort(reason);

    await expect(pending).rejects.toBe(reason);
    expect(cancel).toHaveBeenCalledOnce();
    expect(body.locked).toBe(false);
  });

  it('cancels before returning an iterator when the caller already aborted', () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({ cancel });
    const reason = new Error('cancelled before the body');

    expect(() => readTaskCsvExport(response(body), AbortSignal.abort(reason))).toThrow(reason);

    expect(cancel).toHaveBeenCalledOnce();
    expect(body.locked).toBe(false);
  });

  it.each(['application/json', 'application/x-ndjson; charset=utf-16'])(
    'cancels a response with content type %s',
    (mediaType) => {
      const cancel = vi.fn();
      const body = new ReadableStream<Uint8Array>({ cancel });

      expect(() => readTaskCsvExport(response(body, mediaType))).toThrow();
      expect(cancel).toHaveBeenCalledOnce();
    },
  );
});

import {
  ExportListTasksInternalResponse,
  exportListTasksInternalResponseRowsMax,
} from '@cadenway/contracts/validators/internal/task-service';
import { z } from 'zod';

import { conformBody, outsideContract } from '../../problems/upstream-answer.js';

/** Internal response media type for streaming CSV projections from task-service. */
export const TASK_CSV_NDJSON = 'application/x-ndjson';

const MAX_RECORD_BYTES = 128 * 1024;
const TASK_SERVICE = 'task-service';
const OPERATION = 'exportListTasksInternal';
const projection = ExportListTasksInternalResponse.shape;
const projectionRow = projection.rows.element;
const ndjsonContentType = /^application\/x-ndjson(?:\s*;\s*charset\s*=\s*(?:utf-8|"utf-8"))?$/iu;

const recordSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('metadata'),
    filename: projection.filename,
    header: projection.header.refine((header) => !header.endsWith('\r\n')),
  }),
  z.strictObject({
    kind: z.literal('row'),
    row: projectionRow
      .extend({
        assigneeIds: projectionRow.shape.assigneeIds.refine(
          (ids) => new Set(ids.map((id) => id.toLowerCase())).size === ids.length,
        ),
      })
      .strict(),
  }),
  z.strictObject({
    kind: z.literal('complete'),
    rowCount: z.number().int().min(0).max(exportListTasksInternalResponseRowsMax),
  }),
]);

/** A validated task export record, with completion withheld until clean EOF. */
export type TaskCsvExportFrame = z.output<typeof recordSchema>;

/** Decodes LF-delimited JSON using a fixed byte buffer and never exposes rejected record text. */
async function* readRecords(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<TaskCsvExportFrame> {
  const reader = body.getReader();
  const line = new Uint8Array(MAX_RECORD_BYTES - 1);
  const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
  const cancel = (): void => {
    void reader.cancel().catch(() => undefined);
  };

  let length = 0;
  let reachedEof = false;
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    signal?.throwIfAborted();
    for (;;) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch {
        signal?.throwIfAborted();
        throw outsideContract(TASK_SERVICE, OPERATION, 'an interrupted export stream');
      }
      signal?.throwIfAborted();
      if (chunk.done) {
        reachedEof = true;
        break;
      }
      for (let offset = 0; offset < chunk.value.length;) {
        const newline = chunk.value.indexOf(10, offset);
        const end = newline === -1 ? chunk.value.length : newline;
        const fragment = chunk.value.subarray(offset, end);
        if (length + fragment.length > line.length) {
          throw outsideContract(TASK_SERVICE, OPERATION, 'an oversized export record');
        }
        line.set(fragment, length);
        length += fragment.length;
        offset = end + 1;
        if (newline !== -1) {
          let parsed: unknown;
          try {
            parsed = JSON.parse(decoder.decode(line.subarray(0, length)));
          } catch {
            throw outsideContract(
              TASK_SERVICE,
              OPERATION,
              'invalid UTF-8 or JSON in an export record',
            );
          }
          length = 0;
          yield conformBody(TASK_SERVICE, OPERATION, recordSchema, parsed);
          signal?.throwIfAborted();
        }
      }
    }
    if (length !== 0) {
      throw outsideContract(TASK_SERVICE, OPERATION, 'an unterminated export record');
    }
  } finally {
    signal?.removeEventListener('abort', cancel);
    if (!reachedEof) cancel();
    reader.releaseLock();
  }
}

/** Validates the wire order and emits the completion record only after checking the entire body. */
async function* readProjection(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<TaskCsvExportFrame> {
  let metadataSeen = false;
  let rows = 0;
  let completion: Extract<TaskCsvExportFrame, { kind: 'complete' }> | undefined;

  for await (const frame of readRecords(body, signal)) {
    if (completion !== undefined) {
      throw outsideContract(TASK_SERVICE, OPERATION, 'an export record after completion');
    }
    if (!metadataSeen) {
      if (frame.kind !== 'metadata') {
        throw outsideContract(TASK_SERVICE, OPERATION, 'a missing first export record');
      }
      metadataSeen = true;
    } else {
      if (frame.kind === 'metadata') {
        throw outsideContract(TASK_SERVICE, OPERATION, 'duplicate export metadata');
      }
      if (frame.kind === 'row') {
        rows += 1;
        if (rows > exportListTasksInternalResponseRowsMax) {
          throw outsideContract(TASK_SERVICE, OPERATION, 'too many export rows');
        }
      } else {
        if (frame.rowCount !== rows) {
          throw outsideContract(TASK_SERVICE, OPERATION, 'an inconsistent export row count');
        }
        completion = frame;
        continue;
      }
    }
    yield frame;
  }
  if (completion === undefined) {
    throw outsideContract(TASK_SERVICE, OPERATION, 'a missing export completion record');
  }
  signal?.throwIfAborted();
  yield completion;
}

/** Opens the validated internal export body without buffering the CSV projection in memory. */
export function readTaskCsvExport(
  response: Response,
  signal?: AbortSignal,
): AsyncIterable<TaskCsvExportFrame> {
  const contentType = response.headers.get('Content-Type')?.trim() ?? '';
  if (response.status !== 200 || !ndjsonContentType.test(contentType) || response.body === null) {
    void response.body?.cancel().catch(() => undefined);
    throw outsideContract(TASK_SERVICE, OPERATION, 'an unexpected export response');
  }
  if (signal?.aborted === true) {
    void response.body.cancel().catch(() => undefined);
    signal.throwIfAborted();
  }
  return readProjection(response.body, signal);
}

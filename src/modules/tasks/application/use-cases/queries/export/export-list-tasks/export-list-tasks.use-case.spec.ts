import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ListTaskCsv } from '../../../../models/export/list-task-csv.model.js';
import type { ListTaskExportFrame } from '../../../../models/export/list-task-export-frame.model.js';
import type { ListTaskExportRow } from '../../../../models/export/list-task-export-row.model.js';
import { ListTaskExportUnavailable } from '../../../../models/export/list-task-export-unavailable.model.js';
import type { ListTaskCsvSpool } from '../../../../ports/outbound/files/export/list-task-csv-spool.port.js';
import type { MemberNameSource } from '../../../../ports/outbound/organization-service/export/member-name-source.port.js';
import type { ListTaskExportSource } from '../../../../ports/outbound/task-service/export/list-task-export-source.port.js';
import { ExportListTasks } from './export-list-tasks.use-case.js';

const HEADER = '"Identifiant";"Nom";"Statut";"Priorité";"Assignés";"Échéance";"Étiquettes"';
const FIRST = '00000001-1000-4000-8000-000000000001';
const SECOND = '00000002-2000-4000-8000-000000000002';
const THIRD = '00000003-3000-4000-8000-000000000003';
const UNKNOWN = 'abcdef04-4000-4000-8000-000000000004';
const FORMULA_LIKE_NAME = '\u200B=2+2; "Quoted"';

function row(key: string, assigneeIds: readonly string[]): ListTaskExportRow {
  return {
    beforeAssignees: [`"${key}"`, '"Task; ""example"""', '"À faire"', '"Haute"'],
    assigneeIds,
    afterAssignees: ['""', '"Label"'],
  };
}

function* projection(rows: readonly ListTaskExportRow[]): Generator<ListTaskExportFrame> {
  yield { kind: 'metadata', filename: 'sprint-14.csv', header: HEADER };
  for (const task of rows) yield { kind: 'row', row: task };
  yield { kind: 'complete', rowCount: rows.length };
}

function assigneeLine(key: string, assignees: string): string {
  return `"${key}";"Task; ""example""";"À faire";"Haute";"${assignees}";"";"Label"`;
}

function manyRows(count: number): ListTaskExportRow[] {
  const rows = [];
  for (let i = 0; i < count; i += 20) {
    const assignees = Array.from(
      { length: Math.min(20, count - i) },
      (_, j) => `00000000-1000-4000-8000-${(i + j).toString(16).padStart(12, '0')}`,
    );
    rows.push(row(`CAD-${String(i)}`, assignees));
  }
  return rows;
}

function testSpool() {
  let header = '';
  const rows: string[] = [];
  const dispose = vi.fn().mockResolvedValue(undefined);
  const writeRows = vi.fn<ListTaskCsvSpool['writeRows']>((lines) => {
    rows.push(...lines);
    return Promise.resolve();
  });
  const spool: ListTaskCsvSpool = {
    writeHeader: vi.fn((line: string) => {
      header = line;
      return Promise.resolve();
    }),
    writeRows,
    finish: (filename, order) => {
      const text = header + (order?.map((index) => rows[index]) ?? rows).join('');
      return {
        filename,
        byteLength: Buffer.byteLength(text),
        stream: () => readSequentially([Buffer.from(text, 'utf8')]),
        dispose,
      };
    },
    dispose,
  };
  return { spool, dispose, writeRows };
}

function readSequentially<T>(values: Iterable<T>): AsyncIterable<T> {
  return {
    [Symbol.asyncIterator]: () => {
      const iterator = values[Symbol.iterator]();
      return { next: () => Promise.resolve(iterator.next()) };
    },
  };
}

async function contentOf(csv: ListTaskCsv): Promise<string> {
  let content = '';
  for await (const chunk of csv.stream()) content += Buffer.from(chunk).toString('utf8');
  return content;
}

function setup(rows: readonly ListTaskExportRow[]): {
  readonly read: ReturnType<typeof vi.fn<ListTaskExportSource['read']>>;
  readonly lookup: ReturnType<typeof vi.fn<MemberNameSource['lookup']>>;
  readonly dispose: ReturnType<typeof vi.fn>;
  readonly writeRows: ReturnType<typeof vi.fn<ListTaskCsvSpool['writeRows']>>;
  readonly exportList: ExportListTasks;
} {
  const read = vi
    .fn<ListTaskExportSource['read']>()
    .mockImplementation(() => Promise.resolve(readSequentially(projection(rows))));
  const lookup = vi.fn<MemberNameSource['lookup']>().mockResolvedValue({ items: [] });
  const { spool, dispose, writeRows } = testSpool();
  const exportList = new ExportListTasks(
    { read },
    { lookup },
    { open: () => Promise.resolve(spool) },
  );
  return { read, lookup, dispose, writeRows, exportList };
}

describe('ExportListTasks', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('relays the original filters and preserves all encoded cells, filenames and non-people order', async () => {
    const { read, lookup, exportList } = setup([
      row('CAD-482', [UNKNOWN.toUpperCase(), SECOND, FIRST]),
      row('CAD-474', [FIRST]),
    ]);
    lookup.mockResolvedValue({
      items: [
        { userId: FIRST, name: 'Élodie' },
        { userId: SECOND, name: FORMULA_LIKE_NAME },
        { userId: THIRD, name: 'Unrequested' },
      ],
    });
    const query = {
      search: 'filtre',
      sheetSortColumn: 'priority',
      sheetSortDirection: 'desc',
    } as const;
    const csv = await exportList.execute('list-id', query);

    expect(read).toHaveBeenCalledWith('list-id', query, expect.any(AbortSignal));
    expect(lookup).toHaveBeenCalledExactlyOnceWith(
      [UNKNOWN, SECOND, FIRST],
      expect.any(AbortSignal),
    );
    expect(csv.filename).toBe('sprint-14.csv');
    expect(await contentOf(csv)).toBe(
      [
        HEADER,
        assigneeLine('CAD-482', '\'\u200B=2+2; ""Quoted"", Élodie'),
        assigneeLine('CAD-474', 'Élodie'),
        '',
      ].join('\r\n'),
    );
  });

  it.each([
    { direction: undefined, keys: ['CAD-3', 'CAD-4', 'CAD-1', 'CAD-2', 'CAD-5'] },
    { direction: 'desc' as const, keys: ['CAD-1', 'CAD-3', 'CAD-4', 'CAD-2', 'CAD-5'] },
  ])(
    'sorts first assignees in French with stable ties and missing names last ($direction)',
    async ({ direction, keys }) => {
      const { lookup, exportList } = setup([
        row('CAD-1', [FIRST]),
        row('CAD-2', [UNKNOWN, THIRD]),
        row('CAD-3', [SECOND]),
        row('CAD-4', [THIRD]),
        row('CAD-5', []),
      ]);
      lookup.mockResolvedValue({
        items: [
          { userId: THIRD, name: 'Élodie' },
          { userId: FIRST, name: 'Zoé' },
          { userId: SECOND, name: 'Élodie' },
        ],
      });

      const csv = await exportList.execute('list-id', {
        sheetSortColumn: 'people',
        sheetSortDirection: direction,
      });
      const content = await contentOf(csv);
      expect(content.match(/CAD-\d+/g)).toEqual(keys);
      expect(content).toContain(assigneeLine('CAD-2', 'Élodie'));
    },
  );

  it('returns a header-only file without consulting the directory for an empty list', async () => {
    const { lookup, exportList } = setup([]);
    const csv = await exportList.execute('list-id', {});
    expect(await contentOf(csv)).toBe(`${HEADER}\r\n`);
    expect(lookup).not.toHaveBeenCalled();
  });

  it('looks up assignees in bounded batches before reading the next set of rows', async () => {
    const { lookup, writeRows, exportList } = setup(manyRows(5201));
    await exportList.execute('list-id', {});
    expect(lookup.mock.calls.map(([ids]) => ids.length)).toEqual([2560, 2560, 81]);
    expect(writeRows.mock.calls.map(([lines]) => lines.length)).toEqual([128, 128, 5]);
    expect(new Set(lookup.mock.calls.flatMap(([ids]) => ids)).size).toBe(5201);
  });

  it('releases the whole export when one directory batch fails after another succeeds', async () => {
    const { lookup, dispose, exportList } = setup(manyRows(2561));
    lookup
      .mockResolvedValueOnce({ items: [] })
      .mockRejectedValueOnce(new Error('Directory failure'));

    await expect(exportList.execute('list-id', {})).rejects.toMatchObject({
      service: 'organization-service',
      code: 'upstream.unavailable',
    });
    expect(lookup).toHaveBeenCalledTimes(2);
    expect(lookup.mock.calls.every(([, signal]) => signal.aborted)).toBe(true);
    expect(dispose).toHaveBeenCalledOnce();
  });

  it('uses the same deadline for Task and a stalled directory and cancels the lookup', async () => {
    vi.useFakeTimers();
    const { read, lookup, dispose, exportList } = setup(manyRows(2561));
    read.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(resolve, 60, readSequentially(projection(manyRows(2561)))),
        ),
    );
    lookup.mockImplementation(
      (_ids, signal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener(
            'abort',
            () => {
              reject(new Error('Lookup cancelled.'));
            },
            { once: true },
          );
        }),
    );
    const pending = exportList.execute('list-id', {}, 100);
    const assertion = expect(pending).rejects.toMatchObject({
      service: 'organization-service',
      code: 'upstream.deadline-exceeded',
    });
    await vi.advanceTimersByTimeAsync(99);
    expect(lookup).toHaveBeenCalledOnce();
    expect(lookup.mock.calls[0]?.[1].aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await assertion;
    expect(lookup.mock.calls[0]?.[1].aborted).toBe(true);
    expect(dispose).toHaveBeenCalledOnce();
  });

  it('skips the directory and preserves Task errors for the public problem mapper', async () => {
    const taskFailure = new Error('Task refused access');
    const { read, lookup, exportList } = setup([]);
    read.mockRejectedValue(taskFailure);
    await expect(exportList.execute('list-id', {})).rejects.toBe(taskFailure);
    expect(lookup).not.toHaveBeenCalled();
    await expect(exportList.execute('list-id', {}, 0)).rejects.toBeInstanceOf(
      ListTaskExportUnavailable,
    );
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('discards incomplete content and refuses work when the spool is occupied', async () => {
    const { read, lookup, dispose, exportList } = setup([]);
    const metadata: ListTaskExportFrame = {
      kind: 'metadata',
      filename: 'sprint-14.csv',
      header: HEADER,
    };
    read.mockResolvedValue(readSequentially([metadata]));
    await expect(exportList.execute('list-id', {})).rejects.toMatchObject({
      service: 'task-service',
    });
    expect(dispose).toHaveBeenCalledOnce();

    read.mockClear();
    const busy = new ExportListTasks({ read }, { lookup }, { open: () => Promise.resolve(null) });
    await expect(busy.execute('list-id', {})).rejects.toMatchObject({ service: 'api-gateway' });
    expect(read).not.toHaveBeenCalled();
  });
});

import type { ListTaskCsv } from '../../../../models/export/list-task-csv.model.js';
import type { ListTaskExportRow } from '../../../../models/export/list-task-export-row.model.js';
import type { ListTaskExportQuery } from '../../../../models/export/list-task-export-query.model.js';
import { ListTaskExportUnavailable } from '../../../../models/export/list-task-export-unavailable.model.js';
import type { ListTaskCsvSpoolFactory } from '../../../../ports/outbound/files/export/list-task-csv-spool-factory.port.js';
import type { ListTaskCsvSpool } from '../../../../ports/outbound/files/export/list-task-csv-spool.port.js';
import type { MemberNameSource } from '../../../../ports/outbound/organization-service/export/member-name-source.port.js';
import type { ListTaskExportSource } from '../../../../ports/outbound/task-service/export/list-task-export-source.port.js';

const REQUEST_BUDGET_MS = 120_000;
const ROW_BATCH_SIZE = 128;
const ROW_BATCH_CHARACTERS = 512_000;
const MAX_ROWS = 10_000;
const NAME_COLLATOR = new Intl.Collator('fr');

/** Quotes the spreadsheet cell, preserving any formula-like text as a literal. */
function assigneeCell(names: readonly string[]): string {
  const text = names.join(', ');
  const literal = /^[\p{White_Space}\p{Cc}\p{Cf}]*[=+\-@]/u.test(text) ? `'${text}` : text;
  return `"${literal.replaceAll('"', '""')}"`;
}

/** Compares the first assignee names while leaving missing names last in both directions. */
function compareNames(
  left: string | undefined,
  right: string | undefined,
  direction: number,
): number {
  if (left === undefined) return right === undefined ? 0 : 1;
  if (right === undefined) return -1;
  return direction * NAME_COLLATOR.compare(left, right);
}

/** Assembles a complete export after Task authorizes the selection and Organization resolves names. */
export class ExportListTasks {
  // #region Constructor
  /** Binds authorized sources and a private spool for prepared exports. */
  public constructor(
    private readonly tasks: ListTaskExportSource,
    private readonly members: MemberNameSource,
    private readonly files: ListTaskCsvSpoolFactory,
  ) {}
  // #endregion

  // #region Methods
  /** Prepares the entire document within one budget and releases failed or cancelled exports. */
  public async execute(
    listId: string,
    query: ListTaskExportQuery,
    budgetMs: number = REQUEST_BUDGET_MS,
    caller?: AbortSignal,
  ): Promise<ListTaskCsv> {
    if (budgetMs <= 0) {
      throw new ListTaskExportUnavailable('task-service', 'upstream.deadline-exceeded');
    }
    caller?.throwIfAborted();
    const lifetime = new AbortController();
    const signal = caller ? AbortSignal.any([caller, lifetime.signal]) : lifetime.signal;
    const timer = setTimeout(
      () => {
        lifetime.abort();
      },
      Math.min(budgetMs, REQUEST_BUDGET_MS),
    );
    const firstNames: (string | undefined)[] | undefined =
      query.sheetSortColumn === 'people' ? [] : undefined;
    let service: ListTaskExportUnavailable['service'] = 'api-gateway';
    let spool: ListTaskCsvSpool | undefined;
    let ready = false;

    try {
      const fileSpool = await this.openSpool();
      spool = fileSpool;
      signal.throwIfAborted();
      service = 'task-service';
      const frames = await this.tasks.read(listId, query, signal);
      let filename: string | undefined;
      let rowCount = 0;
      let complete = false;
      let rows: ListTaskExportRow[] = [];
      let bufferedCharacters = 0;
      for await (const frame of frames) {
        signal.throwIfAborted();
        service = 'task-service';
        if (frame.kind === 'metadata' && filename === undefined) {
          filename = frame.filename;
          service = 'api-gateway';
          await this.write(() => fileSpool.writeHeader(`${frame.header}\r\n`));
          service = 'task-service';
        } else if (
          frame.kind === 'row' &&
          filename !== undefined &&
          !complete &&
          rowCount < MAX_ROWS
        ) {
          rows.push(frame.row);
          const { beforeAssignees, afterAssignees } = frame.row;
          bufferedCharacters += beforeAssignees.reduce((size, cell) => size + cell.length, 0);
          bufferedCharacters += afterAssignees.reduce((size, cell) => size + cell.length, 0);
          rowCount += 1;
        } else if (
          frame.kind === 'complete' &&
          filename !== undefined &&
          frame.rowCount === rowCount &&
          !complete
        ) {
          complete = true;
        } else {
          throw new ListTaskExportUnavailable(service, 'upstream.unavailable');
        }

        if (
          rows.length === ROW_BATCH_SIZE ||
          bufferedCharacters >= ROW_BATCH_CHARACTERS ||
          (complete && rows.length > 0)
        ) {
          service = 'organization-service';
          const names = await this.readNames(rows, signal);
          service = 'api-gateway';
          await this.writeRows(fileSpool, rows, names, firstNames, signal);
          rows = [];
          bufferedCharacters = 0;
          service = 'task-service';
        }
      }
      signal.throwIfAborted();
      if (filename === undefined || !complete) {
        throw new ListTaskExportUnavailable('task-service', 'upstream.unavailable');
      }
      const order = this.orderByPeople(firstNames, query.sheetSortDirection === 'desc' ? -1 : 1);
      const file = fileSpool.finish(filename, order);
      ready = true;
      return file;
    } catch (error) {
      if (lifetime.signal.aborted) {
        throw new ListTaskExportUnavailable(service, 'upstream.deadline-exceeded');
      }
      throw error;
    } finally {
      clearTimeout(timer);
      if (!ready) {
        lifetime.abort();
        await spool?.dispose();
      }
    }
  }

  /** Translates failure to acquire or create a private export file into the public unavailable code. */
  private async openSpool(): Promise<ListTaskCsvSpool> {
    let spool: ListTaskCsvSpool | null;
    try {
      spool = await this.files.open();
    } catch {
      throw new ListTaskExportUnavailable('api-gateway', 'upstream.unavailable');
    }
    if (spool === null) throw new ListTaskExportUnavailable('api-gateway', 'upstream.unavailable');
    return spool;
  }

  /** Resolves names only for distinct accounts selected in this batch. */
  private async readNames(
    rows: readonly ListTaskExportRow[],
    signal: AbortSignal,
  ): Promise<ReadonlyMap<string, string>> {
    const userIds = new Set<string>();
    for (const row of rows) {
      for (const userId of row.assigneeIds) userIds.add(userId.toLowerCase());
    }
    const names = new Map<string, string>();
    if (userIds.size === 0) return names;
    try {
      const response = await this.members.lookup([...userIds], signal);
      for (const { userId, name } of response.items) {
        const id = userId.toLowerCase();
        if (userIds.has(id)) names.set(id, name);
      }
      return names;
    } catch {
      throw new ListTaskExportUnavailable('organization-service', 'upstream.unavailable');
    }
  }

  /** Writes each encoded row once and records only the sorting name when it is needed. */
  private async writeRows(
    spool: ListTaskCsvSpool,
    rows: readonly ListTaskExportRow[],
    names: ReadonlyMap<string, string>,
    firstNames: (string | undefined)[] | undefined,
    signal: AbortSignal,
  ): Promise<void> {
    for (const row of rows) {
      signal.throwIfAborted();
      const knownNames = row.assigneeIds.flatMap((id) => {
        const name = names.get(id.toLowerCase());
        return name === undefined ? [] : [name];
      });
      const cells = [...row.beforeAssignees, assigneeCell(knownNames), ...row.afterAssignees];
      await this.write(() => spool.writeRow(`${cells.join(';')}\r\n`));
      const firstAssignee = row.assigneeIds[0]?.toLowerCase();
      firstNames?.push(firstAssignee === undefined ? undefined : names.get(firstAssignee));
    }
  }

  /** Hides local disk paths and system diagnostics from an unavailable export. */
  private async write(write: () => Promise<void>): Promise<void> {
    try {
      await write();
    } catch {
      throw new ListTaskExportUnavailable('api-gateway', 'upstream.unavailable');
    }
  }

  /** Uses stable French collation and retains Task order to break ties. */
  private orderByPeople(
    firstNames: readonly (string | undefined)[] | undefined,
    direction: number,
  ): readonly number[] | undefined {
    return firstNames
      ?.map((name, position) => ({ name, position }))
      .sort((left, right) => compareNames(left.name, right.name, direction))
      .map(({ position }) => position);
  }
  // #endregion
}

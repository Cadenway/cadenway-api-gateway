import { InvalidReminderCursor } from '../../../../models/reminder/invalid-reminder-cursor.model.js';
import type { ReminderListPage } from '../../../../models/reminder/reminder-list-page.model.js';
import type { ReminderListPosition } from '../../../../models/reminder/reminder-list-position.model.js';
import type { ReminderListRequest } from '../../../../models/reminder/reminder-list-request.model.js';
import { ReminderListUnavailable } from '../../../../models/reminder/reminder-list-unavailable.model.js';
import type { ReminderPageCursor } from '../../../../ports/outbound/crypto/reminder/reminder-page-cursor.port.js';
import type { ReminderListSource } from '../../../../ports/outbound/notification-service/reminder/reminder-list-source.port.js';
import type { ReminderTaskDirectory } from '../../../../ports/outbound/task-service/reminder/reminder-task-directory.port.js';

const DEFAULT_PAGE_SIZE = 50;
const CANDIDATE_PAGE_SIZE = 100;
const REQUEST_BUDGET_MS = 10_000;
const SNAPSHOT_ATTEMPTS = 3;

type Candidate = ReminderListPosition & { readonly taskId: string };
type Service = ReminderListUnavailable['service'];

/** Shared cancellation and monotonic deadline for one complete public request. */
interface ListBudget {
  // #region Properties
  /** Aborts both the aggregate wait and any underlying requests. */
  readonly signal: AbortSignal;

  /** The deadline on the monotonic performance clock, in milliseconds. */
  readonly expiresAt: number;
  // #endregion
}

/** PostgreSQL orders the candidate instant first, then the UUID bytes. */
function comparePosition(left: ReminderListPosition, right: ReminderListPosition): number {
  const byTime = Date.parse(left.remindAt) - Date.parse(right.remindAt);
  if (byTime !== 0) return byTime;
  const leftId = left.id.toLowerCase();
  const rightId = right.id.toLowerCase();
  return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
}

/** Builds the complete pending reminder page and count from one Notification generation. */
export class ListReminders {
  // #region Constructor
  /** Binds owner-scoped Notification and Task reads and a scope-bound public cursor codec. */
  public constructor(
    private readonly reminders: ReminderListSource,
    private readonly tasks: ReminderTaskDirectory,
    private readonly cursors: ReminderPageCursor,
  ) {}
  // #endregion

  // #region Methods
  /** Scans and verifies the complete result before returning any part of it. */
  public async execute(
    request: ReminderListRequest,
    budgetMs: number = REQUEST_BUDGET_MS,
    caller?: AbortSignal,
  ): Promise<ReminderListPage> {
    const limit = request.limit ?? DEFAULT_PAGE_SIZE;
    if (!Number.isInteger(limit) || limit < 1 || limit > CANDIDATE_PAGE_SIZE) {
      throw new RangeError('The reminder page size must be between 1 and 100.');
    }
    const scope = { organizationId: request.organizationId, userId: request.userId };
    const position = request.cursor === undefined ? null : this.cursors.open(request.cursor, scope);
    if (
      request.cursor !== undefined &&
      (position === null || !Number.isFinite(Date.parse(position.remindAt)))
    ) {
      throw new InvalidReminderCursor();
    }
    if (!Number.isFinite(budgetMs) || budgetMs <= 0) {
      throw new ReminderListUnavailable('upstream.deadline-exceeded', 'notification-service');
    }
    caller?.throwIfAborted();

    const deadline = new AbortController();
    const signal = caller ? AbortSignal.any([caller, deadline.signal]) : deadline.signal;
    const duration = Math.min(budgetMs, REQUEST_BUDGET_MS);
    const budget = { signal, expiresAt: performance.now() + duration };
    const timer = setTimeout(() => {
      deadline.abort();
    }, duration);
    try {
      for (let attempt = 0; attempt < SNAPSHOT_ATTEMPTS; attempt += 1) {
        const scan = await this.scan(position, limit, budget);
        if (scan === null) continue;
        const items = await this.verify(scan.generation, scan.selected, budget);
        if (items === null) continue;

        const last = scan.selected.at(-1);
        const nextCursor =
          scan.hasMore && last !== undefined
            ? this.cursors.seal({ id: last.id, remindAt: last.remindAt }, scope)
            : null;
        if (scan.hasMore && nextCursor === null) {
          throw new ReminderListUnavailable('upstream.failed', 'api-gateway');
        }
        return { items, nextCursor, pendingCount: scan.pendingCount };
      }
      throw new ReminderListUnavailable('upstream.unavailable', 'notification-service');
    } catch (error: unknown) {
      caller?.throwIfAborted();
      throw error;
    } finally {
      clearTimeout(timer);
      deadline.abort();
    }
  }

  /** Counts every visible candidate and keeps only the requested page's references. */
  private async scan(
    after: ReminderListPosition | null,
    limit: number,
    budget: ListBudget,
  ): Promise<{
    readonly generation: string;
    readonly selected: readonly Candidate[];
    readonly pendingCount: number;
    readonly hasMore: boolean;
  } | null> {
    const selected: Candidate[] = [];
    const seen = new Set<string>();
    const cursors = new Set<string>();
    let generation: string | undefined;
    let cursor: string | undefined;
    let previous: Candidate | undefined;
    let pendingCount = 0;
    let hasMore = false;
    do {
      const query = { limit: CANDIDATE_PAGE_SIZE, ...(cursor === undefined ? {} : { cursor }) };
      const page = await this.within(budget, 'notification-service', () =>
        this.reminders.page(query, budget.signal),
      );
      if (page === null || (generation !== undefined && page.generation !== generation)) {
        return null;
      }
      generation = page.generation;
      this.checkPage(page.items, previous, seen);
      previous = page.items.at(-1) ?? previous;
      if (page.items.length > 0) {
        const visibility = await this.lookup(page.items, false, budget);
        for (const [index, candidate] of page.items.entries()) {
          if (visibility[index]?.visible !== true) continue;
          pendingCount += 1;
          if (after !== null && comparePosition(candidate, after) <= 0) continue;
          if (selected.length < limit) selected.push(candidate);
          else hasMore = true;
        }
      }
      if (page.nextCursor === null) return { generation, selected, pendingCount, hasMore };
      if (page.items.length === 0 || cursors.has(page.nextCursor)) {
        throw new ReminderListUnavailable('upstream.failed', 'notification-service');
      }
      cursors.add(page.nextCursor);
      cursor = page.nextCursor;
    } while (!budget.signal.aborted);
    throw new ReminderListUnavailable('upstream.deadline-exceeded', 'notification-service');
  }

  /** Rejects invalid ordering or duplicate reminder identities before they can affect the count. */
  private checkPage(
    items: readonly Candidate[],
    previous: Candidate | undefined,
    seen: Set<string>,
  ): void {
    if (items.length > CANDIDATE_PAGE_SIZE) {
      throw new ReminderListUnavailable('upstream.failed', 'notification-service');
    }
    for (const item of items) {
      const id = item.id.toLowerCase();
      if (
        !Number.isFinite(Date.parse(item.remindAt)) ||
        (previous !== undefined && comparePosition(item, previous) <= 0) ||
        seen.has(id)
      ) {
        throw new ReminderListUnavailable('upstream.failed', 'notification-service');
      }
      seen.add(id);
      previous = item;
    }
  }

  /** Rechecks and enriches only selected Task references before fetching their private notes. */
  private async verify(
    generation: string,
    selected: readonly Candidate[],
    budget: ListBudget,
  ): Promise<ReminderListPage['items'] | null> {
    const display = selected.length === 0 ? [] : await this.lookup(selected, true, budget);
    if (display.some((result) => !result.visible)) return null;
    const pairs = selected.map(({ id, taskId }) => ({ id, taskId }));
    const records = await this.within(budget, 'notification-service', () =>
      this.reminders.selected(generation, pairs, budget.signal),
    );
    if (records?.length !== selected.length) return null;

    const items: ReminderListPage['items'][number][] = [];
    for (const [index, record] of records.entries()) {
      const candidate = selected[index];
      if (
        candidate === undefined ||
        comparePosition(candidate, record) !== 0 ||
        candidate.taskId.toLowerCase() !== record.taskId.toLowerCase() ||
        record.completedAt !== null
      ) {
        return null;
      }
      const decision = display[index];
      const task = decision?.visible ? decision.display : undefined;
      if (task?.taskId.toLowerCase() !== record.taskId.toLowerCase()) {
        throw new ReminderListUnavailable('upstream.failed', 'task-service');
      }
      items.push({
        id: record.id,
        taskKey: task.taskKey,
        taskName: task.taskName,
        remindAt: record.remindAt,
        note: record.note,
        firedAt: record.firedAt,
        completedAt: null,
        version: record.version,
      });
    }
    return items;
  }

  /** Resolves precise positional Task decisions without accepting a partial answer. */
  private async lookup(
    candidates: readonly Candidate[],
    includeDisplay: boolean,
    budget: ListBudget,
  ): ReturnType<ReminderTaskDirectory['lookup']> {
    const result = await this.within(budget, 'task-service', () =>
      this.tasks.lookup(
        candidates.map(({ taskId }) => taskId),
        includeDisplay,
        budget.signal,
      ),
    );
    if (result.length !== candidates.length) {
      throw new ReminderListUnavailable('upstream.failed', 'task-service');
    }
    return result;
  }

  /** Bounds each wait by the same request deadline even if a dependency is still settling. */
  private async within<T>(
    { signal, expiresAt }: ListBudget,
    service: Service,
    call: () => Promise<T>,
  ): Promise<T> {
    const expired = new ReminderListUnavailable('upstream.deadline-exceeded', service);
    const ensureTime = (): void => {
      if (signal.aborted || performance.now() >= expiresAt) throw expired;
    };
    ensureTime();
    let onAbort: (() => void) | undefined;
    const interrupted = new Promise<never>((_, reject) => {
      onAbort = () => {
        reject(expired);
      };
      signal.addEventListener('abort', onAbort, { once: true });
    });
    try {
      const result = await Promise.race([call(), interrupted]);
      ensureTime();
      return result;
    } finally {
      if (onAbort !== undefined) signal.removeEventListener('abort', onAbort);
    }
  }
  // #endregion
}

import type { AutomationRulesQuery } from '../../../../models/automations/automation-rules-query.model.js';
import type { AutomationRunCandidate } from '../../../../models/automations/automation-run-candidate.model.js';
import type { AutomationRegistry } from '../../../../ports/outbound/automation-service/rules/automation-registry.port.js';

const MAX_RUNS = 8;
const CANDIDATE_WINDOW = 100;
const CANDIDATE_PAGE_SIZE = 32;

/** Reads rules and the caller's currently visible execution history. */
export class ReadAutomations {
  // #region Constructor
  /** Binds the authorized registry. */
  public constructor(private readonly registry: AutomationRegistry) {}
  // #endregion

  // #region Methods
  /** Returns a cursor-bound rule page or the current user's recent history. */
  public execute(
    input: { kind: 'rules'; query: AutomationRulesQuery } | { kind: 'runs' },
  ): Promise<object> {
    return input.kind === 'rules' ? this.registry.list(input.query) : this.runs();
  }

  /** Returns at most eight current-user-visible recent runs. */
  private async runs(): Promise<{ readonly items: readonly AutomationRunCandidate[] }> {
    const lifetime = new AbortController();
    const { signal } = lifetime;
    const items: AutomationRunCandidate[] = [];
    const visibility = new Map<string, boolean>();
    let processed = 0;
    let cursor: string | null = null;

    try {
      await this.registry.authorize(signal);
      do {
        const page = await this.registry.listRunCandidates(
          {
            limit: Math.min(CANDIDATE_PAGE_SIZE, CANDIDATE_WINDOW - processed),
            ...(cursor === null ? {} : { cursor }),
          },
          signal,
        );
        processed += page.items.length;
        cursor = page.nextCursor;

        const unseenKeys = [...new Set(page.items.map(({ taskKey }) => taskKey))].filter(
          (key) => !visibility.has(key),
        );
        if (unseenKeys.length > 0) {
          const visible = await this.registry.visibleTaskKeys(unseenKeys, signal);
          for (const key of unseenKeys) visibility.set(key, visible.has(key));
        }
        const visibleRuns = page.items.filter(({ taskKey }) => visibility.get(taskKey) === true);
        items.push(...visibleRuns.slice(0, MAX_RUNS - items.length));
      } while (cursor !== null && items.length < MAX_RUNS && processed < CANDIDATE_WINDOW);
      return { items };
    } finally {
      lifetime.abort();
    }
  }
  // #endregion
}

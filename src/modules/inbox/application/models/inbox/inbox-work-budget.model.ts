import { InboxUnavailable } from './inbox-unavailable.model.js';

const ROUTE_BUDGET_MS = 10_000;

/** Bounds scans, retries and final materialization to the same HTTP request budget. */
export async function withInboxBudget<T>(
  work: (signal: AbortSignal) => Promise<T>,
  budgetMs = ROUTE_BUDGET_MS,
): Promise<T> {
  const duration = Math.floor(Math.min(budgetMs, ROUTE_BUDGET_MS));
  if (!Number.isFinite(duration) || duration < 1) {
    throw new InboxUnavailable('api-gateway', 'upstream.deadline-exceeded');
  }
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expiration = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const error = new InboxUnavailable('api-gateway', 'upstream.deadline-exceeded');
      controller.abort(error);
      reject(error);
    }, duration);
  });
  try {
    return await Promise.race([work(controller.signal), expiration]);
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

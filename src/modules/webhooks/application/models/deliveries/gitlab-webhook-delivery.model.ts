import type { GitHubWebhookDelivery } from './git-webhook-delivery.model.js';

/** A GitLab delivery includes the timestamp authenticated by its signature. */
export interface GitLabWebhookDelivery extends GitHubWebhookDelivery {
  // #region Properties
  /** Provider timestamp exactly as received. */
  readonly timestamp: string;
  // #endregion
}

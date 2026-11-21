import type { GitHubWebhookDelivery } from '../../../../models/deliveries/git-webhook-delivery.model.js';
import type { GitLabWebhookDelivery } from '../../../../models/deliveries/gitlab-webhook-delivery.model.js';

/** Relays provider deliveries to the service that owns their authentication. */
export interface GitWebhookReceiver {
  // #region Properties
  /** Accepts a GitHub delivery without decoding its body. */
  readonly github: (input: GitHubWebhookDelivery) => Promise<void>;

  /** Accepts a GitLab delivery without decoding its body. */
  readonly gitlab: (input: GitLabWebhookDelivery) => Promise<void>;
  // #endregion
}

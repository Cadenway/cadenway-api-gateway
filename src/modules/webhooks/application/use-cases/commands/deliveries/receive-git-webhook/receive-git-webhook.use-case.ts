import type { GitHubWebhookDelivery } from '../../../../models/deliveries/git-webhook-delivery.model.js';
import type { GitLabWebhookDelivery } from '../../../../models/deliveries/gitlab-webhook-delivery.model.js';
import type { GitWebhookReceiver } from '../../../../ports/outbound/integration-service/deliveries/git-webhook-receiver.port.js';

/** Relays each authenticated-provider candidate to Integration unchanged. */
export class ReceiveGitWebhook {
  // #region Constructor
  /** Binds the integration-service receiver. */
  public constructor(private readonly receiver: GitWebhookReceiver) {}
  // #endregion

  // #region Methods
  /** Sends GitHub bytes and metadata to the owner. */
  public execute(
    input:
      | { provider: 'github'; delivery: GitHubWebhookDelivery }
      | { provider: 'gitlab'; delivery: GitLabWebhookDelivery },
  ): Promise<void> {
    return input.provider === 'github'
      ? this.receiver.github(input.delivery)
      : this.receiver.gitlab(input.delivery);
  }
  // #endregion
}

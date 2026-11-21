import type { RequestAllowance } from '../../../../models/requests/request-allowance.model.js';
import type { WebhookProvider } from '../../../../models/requests/webhook-provider.model.js';
import type { RequestCounter } from '../../../../ports/outbound/counters/requests/request-counter.port.js';
import type { AddressPseudonymizer } from '../../../../ports/outbound/pseudonyms/addresses/address-pseudonymizer.port.js';

/** Maximum deliveries per provider and client network in one fixed minute. */
export const WEBHOOK_REQUESTS_PER_MINUTE = 60;

/** Counts public webhook deliveries by provider and client network. */
export class CountWebhookRequest {
  // #region Constructor
  /** Binds the dedicated counters and address pseudonymizer. */
  public constructor(
    private readonly counters: Readonly<Record<WebhookProvider, RequestCounter>>,
    private readonly pseudonymizer: AddressPseudonymizer,
  ) {}
  // #endregion

  // #region Methods
  /** Counts a delivery without retaining the address, receiver or provider headers. */
  public execute(clientAddress: string, provider: WebhookProvider): Promise<RequestAllowance> {
    return this.counters[provider].consume(
      `webhook-${provider}:${this.pseudonymizer.pseudonymize(clientAddress)}`,
    );
  }
  // #endregion
}

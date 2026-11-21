import type { SubscriptionPort } from '../../../../ports/outbound/billing/subscription/subscription.port.js';

/** Reads the selected organization's subscription through the authorized source. */
export class GetSubscription {
  // #region Constructor
  /** Binds the owner-verified subscription reader. */
  public constructor(private readonly subscription: SubscriptionPort) {}
  // #endregion

  // #region Methods
  /** Resolves the authorized subscription. */
  public execute(): Promise<object> {
    return this.subscription.read();
  }
  // #endregion
}

/** The original Stripe delivery forwarded to Billing. */
export interface StripeWebhookDelivery {
  // #region Properties
  /** Exact bytes received from the provider. */
  readonly body: Buffer;

  /** The single signature header received from the provider. */
  readonly signature: string;
  // #endregion
}

/** The Billing-owned endpoint that verifies and accepts Stripe deliveries. */
export interface StripeWebhookPort {
  // #region Methods
  /** Forwards one delivery and resolves only after Billing accepts it. */
  receive(input: StripeWebhookDelivery): Promise<void>;
  // #endregion
}

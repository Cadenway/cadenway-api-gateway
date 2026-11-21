/** The original Stripe delivery forwarded to Billing. */
export interface StripeWebhookDelivery {
  // #region Properties
  /** Exact bytes received from the provider. */
  readonly body: Buffer;

  /** The single signature header received from the provider. */
  readonly signature: string;
  // #endregion
}

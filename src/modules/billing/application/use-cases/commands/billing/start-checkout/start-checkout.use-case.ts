import type { PaymentsPort } from '../../../../ports/outbound/billing/payments/payments.port.js';

/** Starts an owner-authorized hosted checkout. */
export class StartCheckout {
  // #region Constructor
  /** Binds the payment source. */
  public constructor(private readonly payments: PaymentsPort) {}
  // #endregion

  // #region Methods
  /** Forwards the validated plan and request identity. */
  public execute(body: { readonly plan: 'team' }, key: string): Promise<object> {
    return this.payments.startCheckout(body, key);
  }
  // #endregion
}

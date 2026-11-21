import type { PaymentsPort } from '../../../../ports/outbound/billing/payments/payments.port.js';

/** Reads the current owner's invoice history. */
export class ListInvoices {
  // #region Constructor
  /** Binds the payment source. */
  public constructor(private readonly payments: PaymentsPort) {}
  // #endregion

  // #region Methods
  /** Forwards one validated page request. */
  public execute(query: { readonly cursor?: string; readonly limit: number }): Promise<object> {
    return this.payments.listInvoices(query);
  }
  // #endregion
}

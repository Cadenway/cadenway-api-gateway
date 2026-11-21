/** Checkout and invoice operations authorized for the current organization owner. */
export interface PaymentsPort {
  // #region Methods
  /** Starts or replays the checkout for the given request identity. */
  startCheckout(body: { readonly plan: 'team' }, key: string): Promise<object>;

  /** Reads one invoice page for the current owner. */
  listInvoices(query: { readonly cursor?: string; readonly limit: number }): Promise<object>;
  // #endregion
}

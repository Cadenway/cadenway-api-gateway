import type { RequestAllowance } from '../../../../models/requests/request-allowance.model.js';
import type { RequestCounter } from '../../../../ports/outbound/counters/requests/request-counter.port.js';
import type { AddressPseudonymizer } from '../../../../ports/outbound/pseudonyms/addresses/address-pseudonymizer.port.js';

/** Counts public form reads and submissions independently for a client network. */
export class CountIntakeRequest {
  // #region Constructor
  /** Binds the two quotas and the existing address pseudonymizer. */
  public constructor(
    private readonly reads: RequestCounter,
    private readonly submissions: RequestCounter,
    private readonly pseudonymizer: AddressPseudonymizer,
  ) {}
  // #endregion

  // #region Methods
  /** Counts the operation before validation or an upstream call. */
  public execute(clientAddress: string, operation: 'read' | 'submit'): Promise<RequestAllowance> {
    const key = `intake-${operation}:${this.pseudonymizer.pseudonymize(clientAddress)}`;
    return (operation === 'read' ? this.reads : this.submissions).consume(key);
  }
  // #endregion
}

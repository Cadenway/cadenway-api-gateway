import type { IntakeOperation } from '../../../../models/requests/intake-operation.model.js';
import type { RequestAllowance } from '../../../../models/requests/request-allowance.model.js';
import type { RequestCounter } from '../../../../ports/outbound/counters/requests/request-counter.port.js';
import type { AddressPseudonymizer } from '../../../../ports/outbound/pseudonyms/addresses/address-pseudonymizer.port.js';

/** Counts public form reads, submissions, and upload mutations independently by client network. */
export class CountIntakeRequest {
  // #region Constructor
  /** Binds the operation quotas and the existing address pseudonymizer. */
  public constructor(
    private readonly counters: Readonly<Record<IntakeOperation, RequestCounter>>,
    private readonly pseudonymizer: AddressPseudonymizer,
  ) {}
  // #endregion

  // #region Methods
  /** Counts the operation before validation or an upstream call. */
  public execute(clientAddress: string, operation: IntakeOperation): Promise<RequestAllowance> {
    const key = `intake-${operation}:${this.pseudonymizer.pseudonymize(clientAddress)}`;
    return this.counters[operation].consume(key);
  }
  // #endregion
}

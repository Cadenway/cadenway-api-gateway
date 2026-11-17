import type { CountAnonymousRequestInput } from './count-anonymous-request.input.js';
import type { RequestAllowance } from '../../../../models/requests/request-allowance.model.js';
import type { RequestCounter } from '../../../../ports/outbound/counters/requests/request-counter.port.js';
import type { AddressPseudonymizer } from '../../../../ports/outbound/pseudonyms/addresses/address-pseudonymizer.port.js';

/**
 * Class CountAnonymousRequest
 *
 * @description
 * Counts one request without a credential against the quota of its client address: 60 requests
 * per minute per address on the public authentication routes. The counter is keyed by
 * `anonymous:` and the pseudonym of the address, never the address itself, so it shares nothing
 * with the counters of the credentials.
 */
export class CountAnonymousRequest {
  // #region Properties
  /**
   * Property counter
   *
   * @description
   * The shared counters of the requests without a credential.
   *
   * @type {RequestCounter}
   * @readonly
   */
  private readonly counter: RequestCounter;

  /**
   * Property pseudonymizer
   *
   * @description
   * Turns a client address into the pseudonym of its counter.
   *
   * @type {AddressPseudonymizer}
   * @readonly
   */
  private readonly pseudonymizer: AddressPseudonymizer;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Binds the counter and the pseudonymizer ports.
   *
   * @param {RequestCounter} counter - The shared counters of the requests without a credential.
   * @param {AddressPseudonymizer} pseudonymizer - Pseudonymizes a client address.
   * @constructor
   */
  public constructor(counter: RequestCounter, pseudonymizer: AddressPseudonymizer) {
    this.counter = counter;
    this.pseudonymizer = pseudonymizer;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Counts the request on the pseudonym of its client address.
   *
   * @param {CountAnonymousRequestInput} input - The client address of the request.
   * @returns {Promise<RequestAllowance>} Whether the request fits in the quota.
   */
  public execute(input: CountAnonymousRequestInput): Promise<RequestAllowance> {
    return this.counter.consume(
      `anonymous:${this.pseudonymizer.pseudonymize(input.clientAddress)}`,
    );
  }
  // #endregion
}

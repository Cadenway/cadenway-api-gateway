import type { CheckBearerFailuresInput } from './check-bearer-failures.input.js';
import type { RequestAllowance } from '../../../../models/requests/request-allowance.model.js';
import type { RequestCounter } from '../../../../ports/outbound/counters/requests/request-counter.port.js';
import type { AddressPseudonymizer } from '../../../../ports/outbound/pseudonyms/addresses/address-pseudonymizer.port.js';

/**
 * Class CheckBearerFailures
 *
 * @description
 * Tells whether a client address may still present a bearer token: 10 failed bearer-token
 * authentications per minute per address. It reads the counter of `CountBearerFailure` without
 * counting. Once the address has used its failures of the window, every bearer token it sends is
 * refused before introspection until the window ends, a valid one too: only the introspection
 * could tell them apart.
 */
export class CheckBearerFailures {
  // #region Properties
  /**
   * Property counter
   *
   * @description
   * The shared counters of the failed bearer-token authentications.
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
   * @param {RequestCounter} counter - The shared counters of the failed bearer authentications.
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
   * Reads the failed bearer-token authentications of the address in the current window.
   *
   * @param {CheckBearerFailuresInput} input - The client address of the request.
   * @returns {Promise<RequestAllowance>} `allowed` while the address has failures left, otherwise
   * the seconds until its window ends.
   */
  public execute(input: CheckBearerFailuresInput): Promise<RequestAllowance> {
    return this.counter.peek(
      `bearer-failures:${this.pseudonymizer.pseudonymize(input.clientAddress)}`,
    );
  }
  // #endregion
}

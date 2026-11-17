import type { CountBearerFailureInput } from './count-bearer-failure.input.js';
import type { RequestCounter } from '../../../../ports/outbound/counters/requests/request-counter.port.js';
import type { AddressPseudonymizer } from '../../../../ports/outbound/pseudonyms/addresses/address-pseudonymizer.port.js';

/**
 * Class CountBearerFailure
 *
 * @description
 * Counts one failed bearer-token authentication of a client address
 * (`401 auth.api-token-invalid`, a malformed token included) against its quota of 10 per minute,
 * which `CheckBearerFailures` reads before the next token of the address is introspected. The
 * counter is keyed by `bearer-failures:` and the pseudonym of the address, never the address
 * itself.
 */
export class CountBearerFailure {
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
   * Counts the failure on the pseudonym of the client address. Past the quota the counter keeps
   * counting within its window; refusing the next token is the job of `CheckBearerFailures`.
   *
   * @param {CountBearerFailureInput} input - The client address of the request.
   * @returns {Promise<void>} Resolves once the failure is counted.
   */
  public async execute(input: CountBearerFailureInput): Promise<void> {
    await this.counter.consume(
      `bearer-failures:${this.pseudonymizer.pseudonymize(input.clientAddress)}`,
    );
  }
  // #endregion
}

import type { CountRequestInput } from './count-request.input.js';
import type { RequestAllowance } from '../../../../models/requests/request-allowance.model.js';
import type { RequestCounter } from '../../../../ports/outbound/counters/requests/request-counter.port.js';

/**
 * Class CountRequest
 *
 * @description
 * Counts one request of a verified credential against its quota (decision 8 of the integration
 * plan: 600 requests per minute per session or personal API token). The counter is keyed by the
 * kind and the id of the credential, so a session and a token never share a counter and no secret
 * ever becomes a key.
 */
export class CountRequest {
  // #region Properties
  /**
   * Property counter
   *
   * @description
   * The shared request counters.
   *
   * @type {RequestCounter}
   * @readonly
   */
  private readonly counter: RequestCounter;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Binds the counter port.
   *
   * @param {RequestCounter} counter - The shared request counters.
   * @constructor
   */
  public constructor(counter: RequestCounter) {
    this.counter = counter;
  }
  // #endregion

  // #region Methods
  /**
   * Method execute
   *
   * @description
   * Counts the request of the credential.
   *
   * @param {CountRequestInput} input - The verified credential of the request.
   * @returns {Promise<RequestAllowance>} Whether the request fits in the quota.
   */
  public execute(input: CountRequestInput): Promise<RequestAllowance> {
    return this.counter.consume(`${input.credentialKind}:${input.credentialId}`);
  }
  // #endregion
}

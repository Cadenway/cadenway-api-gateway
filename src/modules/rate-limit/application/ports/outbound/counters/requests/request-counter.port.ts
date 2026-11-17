import type { RequestAllowance } from '../../../../models/requests/request-allowance.model.js';

/**
 * Interface RequestCounter
 *
 * @description
 * Outgoing port of the rate limit: counts the requests of a key in a fixed window shared by every
 * instance of the gateway. Implemented on the Redis of the gateway.
 */
export interface RequestCounter {
  // #region Methods
  /**
   * Method consume
   *
   * @description
   * Counts one request of a key and tells whether it fits in the quota of the current window.
   *
   * @param {string} key - Key of the counter: the kind and the id of a credential, never a secret.
   * @returns {Promise<RequestAllowance>} Whether the request is allowed, and when to retry.
   */
  consume(key: string): Promise<RequestAllowance>;
  // #endregion
}

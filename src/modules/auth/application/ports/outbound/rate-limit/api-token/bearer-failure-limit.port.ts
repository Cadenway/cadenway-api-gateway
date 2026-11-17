/**
 * Interface BearerFailureLimit
 *
 * @description
 * Outgoing port of the verification of a bearer token: the limit of the failed bearer-token
 * authentications of a client address, 10 per minute. Implemented by the counters of the
 * `rate-limit` capability, keyed by a hash of the address, never the address itself.
 */
export interface BearerFailureLimit {
  // #region Methods
  /**
   * Method secondsUntilAllowed
   *
   * @description
   * Reads, without counting, whether the address may present a bearer token now.
   *
   * @param {string} clientAddress - The address Traefik saw.
   * @returns {Promise<number>} `0` while the address has failures left in its window, otherwise
   * the whole seconds, at least 1, until the window ends.
   */
  secondsUntilAllowed(clientAddress: string): Promise<number>;

  /**
   * Method countFailure
   *
   * @description
   * Counts one failed bearer-token authentication of the address.
   *
   * @param {string} clientAddress - The address Traefik saw.
   * @returns {Promise<void>} Resolves once the failure is counted.
   */
  countFailure(clientAddress: string): Promise<void>;
  // #endregion
}

/**
 * Interface CountAnonymousRequestInput
 *
 * @description
 * The request without a credential to count, by the address of its client.
 */
export interface CountAnonymousRequestInput {
  // #region Properties
  /**
   * Property clientAddress
   *
   * @description
   * The address Traefik saw (`request.ip` behind one trusted hop). It is pseudonymized before it
   * becomes a key and is never stored or logged as is.
   *
   * @type {string}
   * @readonly
   */
  readonly clientAddress: string;
  // #endregion
}

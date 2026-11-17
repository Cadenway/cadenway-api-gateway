/**
 * Interface CountBearerFailureInput
 *
 * @description
 * The client one failed bearer-token authentication is counted for.
 */
export interface CountBearerFailureInput {
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

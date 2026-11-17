/**
 * Interface CheckBearerFailuresInput
 *
 * @description
 * The client whose failed bearer-token authentications are checked before its token is.
 */
export interface CheckBearerFailuresInput {
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

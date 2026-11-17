/**
 * Interface VerifyApiTokenInput
 *
 * @description
 * The bearer token of a request and the client that presents it.
 */
export interface VerifyApiTokenInput {
  // #region Properties
  /**
   * Property token
   *
   * @description
   * The bearer token, or `null` when it does not have the format of a personal API token and so
   * cannot be active. A secret, never logged.
   *
   * @type {string | null}
   * @readonly
   */
  readonly token: string | null;

  /**
   * Property clientAddress
   *
   * @description
   * The address Traefik saw, which the failed authentications are counted on. Personal data,
   * never logged.
   *
   * @type {string}
   * @readonly
   */
  readonly clientAddress: string;
  // #endregion
}

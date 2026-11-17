/**
 * Interface CountRequestInput
 *
 * @description
 * The verified credential a request is counted for.
 */
export interface CountRequestInput {
  // #region Properties
  /**
   * Property credentialKind
   *
   * @description
   * `session` or `api-token`.
   *
   * @type {'session' | 'api-token'}
   * @readonly
   */
  readonly credentialKind: 'session' | 'api-token';

  /**
   * Property credentialId
   *
   * @description
   * Id of the session or of the personal API token, as the introspection returned it; never the
   * secret of the credential.
   *
   * @type {string}
   * @readonly
   */
  readonly credentialId: string;
  // #endregion
}

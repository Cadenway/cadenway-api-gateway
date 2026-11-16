/**
 * Interface DiscoverSignInMethodsOutput
 *
 * @description
 * Gateway-owned data for Identity orchestration.
 */
export interface DiscoverSignInMethodsOutput {
  // #region Properties
  /**
   * Property methods
   *
   * @description
   * Available sign-in methods.
   *
   * @type {{ readonly type: string }[]}
   * @readonly
   */
  readonly methods: { readonly type: string }[];
  // #endregion
}

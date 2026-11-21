import type { FederatedSignInAuthority } from '../../../../ports/outbound/identity/federated-sign-in/federated-sign-in-authority.port.js';

/** Exchange the verified SAML callback for a receipt. */
export class CompleteSamlSignIn {
  // #region Constructor
  /** Receives the authority for the signed-out flow. */
  public constructor(private readonly authority: FederatedSignInAuthority) {}
  // #endregion

  // #region Methods
  /** Delegates the validated request to Identity. */
  public execute(
    request: Parameters<FederatedSignInAuthority['completeSamlSignIn']>[0],
  ): ReturnType<FederatedSignInAuthority['completeSamlSignIn']> {
    return this.authority.completeSamlSignIn(request);
  }
  // #endregion
}

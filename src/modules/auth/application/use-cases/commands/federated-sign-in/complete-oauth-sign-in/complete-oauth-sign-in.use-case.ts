import type { FederatedSignInAuthority } from '../../../../ports/outbound/identity/federated-sign-in/federated-sign-in-authority.port.js';

/** Exchange the verified OAuth callback for a receipt. */
export class CompleteOauthSignIn {
  // #region Constructor
  /** Receives the authority for the signed-out flow. */
  public constructor(private readonly authority: FederatedSignInAuthority) {}
  // #endregion

  // #region Methods
  /** Delegates the validated request to Identity. */
  public execute(
    request: Parameters<FederatedSignInAuthority['completeOAuthSignIn']>[0],
  ): ReturnType<FederatedSignInAuthority['completeOAuthSignIn']> {
    return this.authority.completeOAuthSignIn(request);
  }
  // #endregion
}

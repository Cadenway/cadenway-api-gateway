import type { FederatedSignInAuthority } from '../../../../ports/outbound/identity/federated-sign-in/federated-sign-in-authority.port.js';

/** Redeem a receipt for a session or a two-step challenge. */
export class FinishFederatedSignIn {
  // #region Constructor
  /** Receives the authority for the signed-out flow. */
  public constructor(private readonly authority: FederatedSignInAuthority) {}
  // #endregion

  // #region Methods
  /** Delegates the validated request to Identity. */
  public execute(
    request: Parameters<FederatedSignInAuthority['finishFederatedSignIn']>[0],
  ): ReturnType<FederatedSignInAuthority['finishFederatedSignIn']> {
    return this.authority.finishFederatedSignIn(request);
  }
  // #endregion
}

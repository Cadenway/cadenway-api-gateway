import type { FederatedSignInAuthority } from '../../../../ports/outbound/identity/federated-sign-in/federated-sign-in-authority.port.js';

/** Start a provider flow bound to this browser. */
export class StartFederatedSignIn {
  // #region Constructor
  /** Receives the authority for the signed-out flow. */
  public constructor(private readonly authority: FederatedSignInAuthority) {}
  // #endregion

  // #region Methods
  /** Delegates the validated request to Identity. */
  public execute(
    request: Parameters<FederatedSignInAuthority['startFederatedSignIn']>[0],
  ): ReturnType<FederatedSignInAuthority['startFederatedSignIn']> {
    return this.authority.startFederatedSignIn(request);
  }
  // #endregion
}

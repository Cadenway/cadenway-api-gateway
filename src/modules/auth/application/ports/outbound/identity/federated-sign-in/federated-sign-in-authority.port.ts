import type { FederatedReceipt } from '../../../../models/federated-sign-in/federated-receipt.model.js';
import type { FederatedSignInOutcome } from '../../../../models/federated-sign-in/federated-sign-in-outcome.model.js';

type SocialProvider = 'google' | 'github' | 'microsoft' | 'gitlab';

/** Authority for expiring flows, one-use receipts and verified account sign-in. */
export interface FederatedSignInAuthority {
  // #region Methods
  /** Issues a browser-bound flow for the selected provider. */
  startFederatedSignIn(
    request:
      | { readonly provider: SocialProvider; readonly rememberMe: boolean }
      | { readonly provider: 'saml'; readonly email: string; readonly rememberMe: boolean },
  ): Promise<{
    readonly authorizationUrl: string;
    readonly browserBinding: string;
    readonly expiresAt: string;
  }>;

  /** Verifies an OAuth result and consumes a matching flow. */
  completeOAuthSignIn(request: {
    readonly provider: SocialProvider;
    readonly state: string;
    readonly browserBinding: string;
    readonly response:
      | { readonly outcome: 'authorized'; readonly code: string }
      | { readonly outcome: 'denied'; readonly error: string };
  }): Promise<FederatedReceipt>;

  /** Verifies a SAML response and consumes a matching flow. */
  completeSamlSignIn(request: {
    readonly samlResponse: string;
    readonly relayState: string;
    readonly browserBinding: string;
  }): Promise<FederatedReceipt>;

  /** Redeems a receipt once under the current sign-in policies. */
  finishFederatedSignIn(request: {
    readonly receipt: string;
    readonly client: { readonly ipAddress: string; readonly userAgent: string | null };
    readonly trustedDeviceToken?: string;
  }): Promise<FederatedSignInOutcome>;
  // #endregion
}

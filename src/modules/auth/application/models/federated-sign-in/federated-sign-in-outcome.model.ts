/** Session data or ordinary two-step challenge issued by the Identity authority. */
export type FederatedSignInOutcome =
  | {
      readonly outcome: 'signed-in';
      readonly session: {
        readonly token: string;
        readonly session: {
          readonly id: string;
          readonly expiresAt: string;
          readonly persistent: boolean;
        };
        readonly user: {
          readonly id: string;
          readonly name: string;
          readonly email: string;
          readonly language: string;
          readonly displayName?: string | null;
          readonly jobTitle?: string | null;
          readonly timeZone?: string;
          readonly passwordChangedAt?: string;
          readonly version: number;
        };
        readonly deletionCancelled?: boolean;
      };
    }
  | {
      readonly outcome: 'challenge';
      readonly challenge: {
        readonly token: string;
        readonly expiresAt: string;
        readonly email: string;
        readonly name: string;
        readonly primaryMethod: string;
        readonly methods: readonly string[];
        readonly securityKeys: readonly { readonly name: string }[];
        readonly backupCodesRemaining: number;
        readonly lockedUntil: string | null;
      };
    };

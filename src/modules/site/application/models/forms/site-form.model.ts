/** Validated contact and newsletter submissions accepted by Notification. */
export type SiteForm =
  | {
      readonly kind: 'contact';
      readonly key: string;
      readonly body: {
        readonly email: string;
        readonly subject: 'login' | 'mfa' | 'org' | 'data' | 'other';
        readonly message: string;
      };
    }
  | { readonly kind: 'newsletter'; readonly body: { readonly email: string } };

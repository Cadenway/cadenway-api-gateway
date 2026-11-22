/** A refused admission includes a delay. A granted admission must be released after verification. */
export type PrepareCredentialIntrospectionOutput =
  | { readonly outcome: 'refused'; readonly retryAfterSeconds: number }
  | { readonly outcome: 'granted'; readonly release: () => void };

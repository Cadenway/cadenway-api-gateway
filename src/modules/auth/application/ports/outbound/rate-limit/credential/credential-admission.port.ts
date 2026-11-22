import type { PrepareCredentialIntrospectionOutput } from '../../../../use-cases/commands/credential/prepare-credential-introspection/prepare-credential-introspection.output.js';

/** Prepares capacity for a credential check using the network-wide and process-wide limits. */
export interface CredentialAdmission {
  // #region Methods
  /** Reserves a slot, or gives the refusal's Retry-After delay. */
  execute(clientAddress: string): Promise<PrepareCredentialIntrospectionOutput>;
  // #endregion
}

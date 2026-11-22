import type { CredentialAdmission } from '../../../../ports/outbound/rate-limit/credential/credential-admission.port.js';
import type { PrepareCredentialIntrospectionOutput } from './prepare-credential-introspection.output.js';

/** Applies the shared credential admission policy before contacting Identity. */
export class PrepareCredentialIntrospection {
  // #region Constructor
  /** Receives the gateway-owned admission port. */
  public constructor(private readonly admission: CredentialAdmission) {}
  // #endregion

  // #region Methods
  /** Holds a slot until the HTTP guard completes the credential verification. */
  public execute(clientAddress: string): Promise<PrepareCredentialIntrospectionOutput> {
    return this.admission.execute(clientAddress);
  }
  // #endregion
}

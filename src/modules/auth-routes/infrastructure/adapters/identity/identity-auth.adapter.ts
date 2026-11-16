import type { IdentityAuth } from '../../../application/ports/outbound/identity/auth/identity-auth.port.js';
import type { IdentityServiceClient } from '../../../../../clients/identity-service.client.js';

/**
 * Function createIdentityAuthAdapter
 *
 * @description
 * Binds the local port to the validating technical client.
 *
 * @param {IdentityServiceClient} client - Technical HTTP client for Identity.
 * @returns {IdentityAuth} Local adapter for the capability.
 */
export function createIdentityAuthAdapter(client: IdentityServiceClient): IdentityAuth {
  return {
    discoverSignInMethods: (request) => client.discoverSignInMethods(request),
    signUp: (request) => client.signUp(request),
    resendSignUpCode: (request) => client.resendSignUpCode(request),
    verifySignUp: (request) => client.verifySignUp(request),
    signInWithPassword: (request) => client.signInWithPassword(request),
    requestSignInCode: (request) => client.requestSignInCode(request),
    signInWithCode: (request) => client.signInWithCode(request),
    revokeSession: (sessionId) => client.revokeSession(sessionId),
  };
}

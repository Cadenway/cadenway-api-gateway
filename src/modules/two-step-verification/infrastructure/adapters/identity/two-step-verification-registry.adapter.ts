import type { SecurityKeyAttestation as InternalSecurityKeyAttestation } from '@cadenway/contracts/types/internal/identity-service';

import type { SecurityKeyAttestation } from '../../../application/models/two-step/security-key-attestation.model.js';
import type { TwoStepVerificationRegistry } from '../../../application/ports/outbound/identity/two-step/two-step-verification-registry.port.js';
import type { IdentityServiceClient } from '../../../../../clients/identity-service.client.js';

/**
 * Function toInternalAttestation
 *
 * @description
 * Copies the answer of the browser for the internal request, whole: the members the contract does
 * not list travel too, since identity-service verifies the whole answer.
 *
 * @param {SecurityKeyAttestation} credential - The answer the public contract validated.
 * @returns {InternalSecurityKeyAttestation} The `credential` of the internal request.
 */
function toInternalAttestation(credential: SecurityKeyAttestation): InternalSecurityKeyAttestation {
  const { transports, ...response } = credential.response;
  return {
    ...credential,
    response: { ...response, ...(transports === undefined ? {} : { transports: [...transports] }) },
  };
}

/**
 * Function createTwoStepVerificationRegistryAdapter
 *
 * @description
 * Binds the local port to the validating technical client of identity-service. Each internal
 * request is rebuilt member by member: the account travels in the path, the session of the request
 * and the browser in the body, so that only the members of the internal contract travel. The
 * WebAuthn answer of the browser is passed whole, as the contract asks.
 *
 * @param {IdentityServiceClient} client - Technical HTTP client for Identity.
 * @returns {TwoStepVerificationRegistry} Local adapter for the capability.
 */
export function createTwoStepVerificationRegistryAdapter(
  client: IdentityServiceClient,
): TwoStepVerificationRegistry {
  return {
    getTwoStepVerification: (request) => client.getTwoStepVerification(request.userId),
    disableTwoStepVerification: (request) =>
      client.disableTwoStepVerification(request.userId, {
        sessionId: request.sessionId,
        client: { ipAddress: request.client.ipAddress, userAgent: request.client.userAgent },
      }),
    startAuthenticatorAppSetup: (request) =>
      client.startAuthenticatorAppSetup(request.userId, { sessionId: request.sessionId }),
    confirmAuthenticatorAppSetup: (request) =>
      client.confirmAuthenticatorAppSetup(request.userId, {
        sessionId: request.sessionId,
        code: request.code,
        client: { ipAddress: request.client.ipAddress, userAgent: request.client.userAgent },
      }),
    regenerateBackupCodes: (request) =>
      client.regenerateBackupCodes(request.userId, {
        sessionId: request.sessionId,
        client: { ipAddress: request.client.ipAddress, userAgent: request.client.userAgent },
      }),
    startSecurityKeyRegistration: (request) =>
      client.startSecurityKeyRegistration(request.userId, { sessionId: request.sessionId }),
    addSecurityKey: (request) =>
      client.addSecurityKey(request.userId, {
        sessionId: request.sessionId,
        name: request.name,
        credential: toInternalAttestation(request.credential),
        client: { ipAddress: request.client.ipAddress, userAgent: request.client.userAgent },
      }),
    removeSecurityKey: (request) =>
      client.removeSecurityKey(request.userId, request.securityKeyId, {
        sessionId: request.sessionId,
        client: { ipAddress: request.client.ipAddress, userAgent: request.client.userAgent },
      }),
  };
}

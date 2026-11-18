import type {
  AuthenticatorAppConfigured as PublicAuthenticatorAppConfigured,
  AuthenticatorAppSetup as PublicAuthenticatorAppSetup,
  BackupCodes as PublicBackupCodes,
  SecurityKey as PublicSecurityKey,
  SecurityKeyRegistration as PublicSecurityKeyRegistration,
  TwoStepVerification as PublicTwoStepVerification,
  WebAuthnCredentialDescriptor as PublicWebAuthnCredentialDescriptor,
} from '@cadenway/contracts/types/public/auth';

import type { AuthenticatorAppConfigured } from '../../../../application/models/two-step/authenticator-app-configured.model.js';
import type { AuthenticatorAppSetup } from '../../../../application/models/two-step/authenticator-app-setup.model.js';
import type { BackupCodes } from '../../../../application/models/two-step/backup-codes.model.js';
import type { SecurityKeyRegistration } from '../../../../application/models/two-step/security-key-registration.model.js';
import type { WebAuthnCredentialDescriptor } from '../../../../application/models/two-step/webauthn-credential-descriptor.model.js';
import type { SecurityKey } from '../../../../application/models/two-step/security-key.model.js';
import type { TwoStepRequirement } from '../../../../application/models/two-step/two-step-requirement.model.js';
import type { TwoStepVerification } from '../../../../application/models/two-step/two-step-verification.model.js';

/**
 * Function toSecurityKey
 *
 * @description
 * Maps a security key to `SecurityKey` of `openapi/public/auth.yaml`, member by member: never its
 * public key or its credential id.
 *
 * @param {SecurityKey} key - The key.
 * @returns {PublicSecurityKey} The public key.
 */
export function toSecurityKey(key: SecurityKey): PublicSecurityKey {
  return { id: key.id, name: key.name, createdAt: key.createdAt, lastUsedAt: key.lastUsedAt };
}

/**
 * Function toTwoStepVerification
 *
 * @description
 * Maps the two-step verification of an account to `TwoStepVerification` of
 * `openapi/public/auth.yaml`, member by member, so that a member identity-service adds later never
 * reaches the applications before the public contract declares it. It holds no secret.
 *
 * @param {TwoStepVerification} state - The two-step verification.
 * @returns {PublicTwoStepVerification} The public state.
 */
export function toTwoStepVerification(state: TwoStepVerification): PublicTwoStepVerification {
  return {
    enabled: state.enabled,
    primaryMethod: state.primaryMethod,
    methods: [...state.methods],
    authenticatorApp:
      state.authenticatorApp === null
        ? null
        : { configuredAt: state.authenticatorApp.configuredAt },
    securityKeys: state.securityKeys.map(toSecurityKey),
    backupCodes:
      state.backupCodes === null
        ? null
        : {
            remaining: state.backupCodes.remaining,
            total: state.backupCodes.total,
            generatedAt: state.backupCodes.generatedAt,
          },
    requiredBy: state.requiredBy.map((requirement: TwoStepRequirement) => ({
      organizationId: requirement.organizationId,
      requiredFor: requirement.requiredFor,
    })),
  };
}

/**
 * Function toAuthenticatorAppSetup
 *
 * @description
 * Maps a pending setup to `AuthenticatorAppSetup`: the secret and its URI reach the browser here,
 * once, and nowhere else.
 *
 * @param {AuthenticatorAppSetup} setup - The pending setup.
 * @returns {PublicAuthenticatorAppSetup} The public setup.
 */
export function toAuthenticatorAppSetup(setup: AuthenticatorAppSetup): PublicAuthenticatorAppSetup {
  return { secret: setup.secret, otpauthUri: setup.otpauthUri, expiresAt: setup.expiresAt };
}

/**
 * Function toBackupCodes
 *
 * @description
 * Maps backup codes to `BackupCodes`: they reach the browser here, once.
 *
 * @param {BackupCodes} codes - The backup codes.
 * @returns {PublicBackupCodes} The public codes.
 */
export function toBackupCodes(codes: BackupCodes): PublicBackupCodes {
  return { codes: [...codes.codes], generatedAt: codes.generatedAt };
}

/**
 * Function toAuthenticatorAppConfigured
 *
 * @description
 * Maps a confirmed app to `AuthenticatorAppConfigured`, with `backupCodes: null` for a
 * reconfiguration, which keeps the current codes.
 *
 * @param {AuthenticatorAppConfigured} configured - The confirmed app.
 * @returns {PublicAuthenticatorAppConfigured} The public answer.
 */
export function toAuthenticatorAppConfigured(
  configured: AuthenticatorAppConfigured,
): PublicAuthenticatorAppConfigured {
  return {
    twoStepVerification: toTwoStepVerification(configured.twoStepVerification),
    backupCodes: configured.backupCodes === null ? null : toBackupCodes(configured.backupCodes),
  };
}

/**
 * Function toCredentialDescriptor
 *
 * @description
 * Copies a WebAuthn credential descriptor for the browser, with the members the contract does not
 * list.
 *
 * @param {WebAuthnCredentialDescriptor} descriptor - The descriptor of identity-service.
 * @returns {PublicWebAuthnCredentialDescriptor} The public descriptor.
 */
function toCredentialDescriptor(
  descriptor: WebAuthnCredentialDescriptor,
): PublicWebAuthnCredentialDescriptor {
  const { transports, ...members } = descriptor;
  return {
    ...members,
    id: descriptor.id,
    type: descriptor.type,
    ...(transports === undefined ? {} : { transports: [...transports] }),
  };
}

/**
 * Function toSecurityKeyRegistration
 *
 * @description
 * Maps a pending registration to `SecurityKeyRegistration`. The contract asks the gateway to pass
 * the creation options on whole (`PublicKeyCredentialCreationOptionsJSON`,
 * `additionalProperties: true`): the web application hands them to the browser, so the members it
 * does not list (`authenticatorSelection`, `attestation`, ...) are kept too.
 *
 * @param {SecurityKeyRegistration} registration - The pending registration.
 * @returns {PublicSecurityKeyRegistration} The public registration.
 */
export function toSecurityKeyRegistration(
  registration: SecurityKeyRegistration,
): PublicSecurityKeyRegistration {
  const { rp, user, pubKeyCredParams, excludeCredentials, ...members } = registration.options;
  return {
    options: {
      ...members,
      challenge: registration.options.challenge,
      rp: { ...rp, name: rp.name },
      user: { ...user, id: user.id, name: user.name, displayName: user.displayName },
      pubKeyCredParams: pubKeyCredParams.map((parameter) => ({
        ...parameter,
        type: parameter.type,
        alg: parameter.alg,
      })),
      ...(excludeCredentials === undefined
        ? {}
        : { excludeCredentials: excludeCredentials.map(toCredentialDescriptor) }),
    },
    expiresAt: registration.expiresAt,
  };
}

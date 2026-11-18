import type {
  SecurityKeyAssertionOptions as PublicSecurityKeyAssertionOptions,
  SignedIn,
  SignInChallenge as PublicSignInChallenge,
  WebAuthnCredentialDescriptor as PublicWebAuthnCredentialDescriptor,
} from '@cadenway/contracts/types/public/auth';

import { toCurrentUser } from '../../../../../../presentation/http/mappers/current-user.mapper.js';
import type { SecurityKeyAssertionOptions } from '../../../../application/models/auth/security-key-assertion-options.model.js';
import type { WebAuthnCredentialDescriptor } from '../../../../application/models/auth/webauthn-credential-descriptor.model.js';
import type { SessionIssued } from '../../../../application/models/auth/session-issued.model.js';
import type { SignInChallenge } from '../../../../application/models/auth/sign-in-challenge.model.js';

/**
 * Function toSignedIn
 *
 * @description
 * Maps a session opened by identity-service to `SignedIn` of `openapi/public/auth.yaml`: the user
 * and the session (its id and expiry), with `deletionCancelled` when identity-service sent it.
 * Neither the session token nor a trusted device token ever reaches the body: they leave the
 * gateway in their cookies only.
 *
 * @param {SessionIssued} issued - Session opened by identity-service.
 * @returns {SignedIn} The public answer.
 */
export function toSignedIn(issued: SessionIssued): SignedIn {
  return {
    user: toCurrentUser(issued.user),
    session: { id: issued.session.id, expiresAt: issued.session.expiresAt },
    ...(issued.deletionCancelled === undefined
      ? {}
      : { deletionCancelled: issued.deletionCancelled }),
  };
}

/**
 * Function toSignInChallenge
 *
 * @description
 * Maps a two-step challenge to `SignInChallenge` of `openapi/public/auth.yaml`, member by member,
 * as the `202` of the sign-ins and the inspection answer it. The token is in the body, as the
 * contract says, and nowhere else: no cookie, no header.
 *
 * @param {SignInChallenge} challenge - The challenge identity-service issued.
 * @returns {PublicSignInChallenge} The public challenge.
 */
export function toSignInChallenge(challenge: SignInChallenge): PublicSignInChallenge {
  return {
    token: challenge.token,
    expiresAt: challenge.expiresAt,
    email: challenge.email,
    name: challenge.name,
    primaryMethod: challenge.primaryMethod,
    methods: [...challenge.methods],
    securityKeys: challenge.securityKeys.map((key: { readonly name: string }) => ({
      name: key.name,
    })),
    backupCodesRemaining: challenge.backupCodesRemaining,
    lockedUntil: challenge.lockedUntil,
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
 * Function toSecurityKeyAssertionOptions
 *
 * @description
 * Maps the WebAuthn options of a challenge to `SecurityKeyAssertionOptions` of
 * `openapi/public/auth.yaml`. The contract asks the gateway to pass the options on whole
 * (`PublicKeyCredentialRequestOptionsJSON`, `additionalProperties: true`): the web application
 * hands them to the browser, so the members it does not list are kept too.
 *
 * @param {SecurityKeyAssertionOptions} options - The options identity-service issued.
 * @returns {PublicSecurityKeyAssertionOptions} The public options.
 */
export function toSecurityKeyAssertionOptions(
  options: SecurityKeyAssertionOptions,
): PublicSecurityKeyAssertionOptions {
  const { allowCredentials, ...members } = options.options;
  return {
    options: {
      ...members,
      challenge: options.options.challenge,
      ...(allowCredentials === undefined
        ? {}
        : { allowCredentials: allowCredentials.map(toCredentialDescriptor) }),
    },
    expiresAt: options.expiresAt,
  };
}

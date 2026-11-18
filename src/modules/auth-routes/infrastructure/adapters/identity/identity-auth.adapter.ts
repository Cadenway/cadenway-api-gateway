import type { IdentityAuth } from '../../../application/ports/outbound/identity/auth/identity-auth.port.js';
import type { IdentityServiceClient } from '../../../../../clients/identity-service.client.js';

/**
 * Function createIdentityAuthAdapter
 *
 * @description
 * Binds the local port to the validating technical client. Each request is rebuilt member by
 * member, so that only the members of the internal contract travel.
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
    signInWithPassword: (request) =>
      client.signInWithPassword({
        email: request.email,
        password: request.password,
        ...(request.rememberMe === undefined ? {} : { rememberMe: request.rememberMe }),
        client: { ipAddress: request.client.ipAddress, userAgent: request.client.userAgent },
        ...(request.trustedDeviceToken === undefined
          ? {}
          : { trustedDeviceToken: request.trustedDeviceToken }),
      }),
    requestSignInCode: (request) => client.requestSignInCode(request),
    signInWithCode: (request) =>
      client.signInWithCode({
        email: request.email,
        code: request.code,
        ...(request.rememberMe === undefined ? {} : { rememberMe: request.rememberMe }),
        client: { ipAddress: request.client.ipAddress, userAgent: request.client.userAgent },
        ...(request.trustedDeviceToken === undefined
          ? {}
          : { trustedDeviceToken: request.trustedDeviceToken }),
      }),
    inspectSignInChallenge: (request) => client.inspectSignInChallenge({ token: request.token }),
    answerSignInChallengeWithAuthenticatorApp: (request) =>
      client.answerSignInChallengeWithAuthenticatorApp({
        token: request.token,
        code: request.code,
        trustDevice: request.trustDevice,
        client: { ipAddress: request.client.ipAddress, userAgent: request.client.userAgent },
      }),
    answerSignInChallengeWithBackupCode: (request) =>
      client.answerSignInChallengeWithBackupCode({
        token: request.token,
        code: request.code,
        trustDevice: request.trustDevice,
        client: { ipAddress: request.client.ipAddress, userAgent: request.client.userAgent },
      }),
    getSignInChallengeSecurityKeyOptions: (request) =>
      client.getSignInChallengeSecurityKeyOptions({ token: request.token }),
    answerSignInChallengeWithSecurityKey: (request) =>
      client.answerSignInChallengeWithSecurityKey({
        token: request.token,
        credential: request.credential,
        trustDevice: request.trustDevice,
        client: { ipAddress: request.client.ipAddress, userAgent: request.client.userAgent },
      }),
    revokeSession: (sessionId) => client.revokeSession(sessionId),
    requestPasswordReset: (request) =>
      client.requestPasswordReset({
        email: request.email,
        client: { ipAddress: request.client.ipAddress, userAgent: request.client.userAgent },
      }),
    inspectPasswordResetLink: (request) =>
      client.inspectPasswordResetLink({ token: request.token }),
    confirmPasswordReset: (request) =>
      client.confirmPasswordReset({
        token: request.token,
        newPassword: request.newPassword,
        closeOtherSessions: request.closeOtherSessions,
        client: { ipAddress: request.client.ipAddress, userAgent: request.client.userAgent },
      }),
    reauthenticate: (request) =>
      client.reauthenticate(request.sessionId, {
        ...(request.password === undefined ? {} : { password: request.password }),
        ...(request.code === undefined ? {} : { code: request.code }),
      }),
  };
}

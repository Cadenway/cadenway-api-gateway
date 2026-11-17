import type { User } from '@cadenway/contracts/types/internal/identity-service';
import type { CurrentUser } from '@cadenway/contracts/types/public/auth';

/**
 * Function toCurrentUser
 *
 * @description
 * Maps an account of identity-service to `CurrentUser` of `openapi/public/auth.yaml`, member by
 * member, so that a member identity-service adds later never reaches the applications before the
 * public contract declares it. Used by the routes that sign in, by `GET /v1/me` and by the routes
 * that change the account.
 *
 * `passwordChangedAt` is passed on when identity-service sends it, and left out otherwise: an
 * identity-service older than `@cadenway/contracts` 0.7.0 does not know it, and the public contract
 * makes it optional for that reason.
 *
 * @param {User} user - Account as identity-service returned it.
 * @returns {CurrentUser} The public account.
 */
export function toCurrentUser(user: User): CurrentUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    language: user.language,
    displayName: user.displayName ?? null,
    jobTitle: user.jobTitle ?? null,
    timeZone: user.timeZone ?? 'Europe/Paris',
    ...(user.passwordChangedAt === undefined ? {} : { passwordChangedAt: user.passwordChangedAt }),
    version: user.version,
  };
}

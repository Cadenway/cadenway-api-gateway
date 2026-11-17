import type { User } from '@cadenway/contracts/types/internal/identity-service';
import type { CurrentUser } from '@cadenway/contracts/types/public/auth';

/**
 * Function toCurrentUser
 *
 * @description
 * Maps an account of identity-service to `CurrentUser` of `openapi/public/auth.yaml`, member by
 * member, so that a member identity-service adds later never reaches the applications before the
 * public contract declares it. Used by the routes that sign in and by `GET /v1/me`.
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
    version: user.version,
  };
}

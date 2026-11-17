import type { Inviter } from '../invitations/inviter.model.js';
import type { InvitingOrganization } from './inviting-organization.model.js';

/**
 * Interface ReceivedInvitation
 *
 * @description
 * A pending invitation addressed to the caller.
 */
export interface ReceivedInvitation {
  // #region Properties
  /**
   * Property id
   *
   * @description
   * Id of the invitation (a UUID).
   *
   * @type {string}
   * @readonly
   */
  readonly id: string;

  /**
   * Property organization
   *
   * @description
   * The organization that invites.
   *
   * @type {InvitingOrganization}
   * @readonly
   */
  readonly organization: InvitingOrganization;

  /**
   * Property role
   *
   * @description
   * Role the caller gets.
   *
   * @type {'admin' | 'member' | 'guest'}
   * @readonly
   */
  readonly role: 'admin' | 'member' | 'guest';

  /**
   * Property invitedBy
   *
   * @description
   * Who sent it.
   *
   * @type {Inviter}
   * @readonly
   */
  readonly invitedBy: Inviter;

  /**
   * Property expiresAt
   *
   * @description
   * When it expires, ISO 8601.
   *
   * @type {string}
   * @readonly
   */
  readonly expiresAt: string;
  // #endregion
}

import type { Inviter } from './inviter.model.js';

/**
 * Interface Invitation
 *
 * @description
 * A pending invitation of the current organization, expired or not.
 */
export interface Invitation {
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
   * Property email
   *
   * @description
   * The invited address.
   *
   * @type {string}
   * @readonly
   */
  readonly email: string;

  /**
   * Property role
   *
   * @description
   * Role the invitee gets.
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
   * Property status
   *
   * @description
   * `pending` or `expired` today; later versions may add statuses.
   *
   * @type {string}
   * @readonly
   */
  readonly status: string;

  /**
   * Property sentAt
   *
   * @description
   * When the email was last sent, ISO 8601.
   *
   * @type {string}
   * @readonly
   */
  readonly sentAt: string;

  /**
   * Property expiresAt
   *
   * @description
   * `sentAt` plus 7 days, ISO 8601.
   *
   * @type {string}
   * @readonly
   */
  readonly expiresAt: string;

  /**
   * Property version
   *
   * @description
   * Version of the invitation, also its entity tag.
   *
   * @type {number}
   * @readonly
   */
  readonly version: number;
  // #endregion
}

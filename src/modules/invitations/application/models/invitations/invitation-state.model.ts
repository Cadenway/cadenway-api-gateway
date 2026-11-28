import type { Inviter } from './inviter.model.js';

/**
 * Interface InvitationState
 *
 * @description
 * An invitation of the current organization in any state of its lifecycle.
 */
export interface InvitationState {
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
   * `pending`, `accepted`, `refused`, `revoked` or `expired` today; later versions may add
   * statuses (`x-extensible-enum`).
   *
   * @type {string}
   * @readonly
   */
  readonly status: string;

  /**
   * Property answeredAt
   *
   * @description
   * When the invitation was accepted or refused, ISO 8601; otherwise `null`.
   *
   * @type {string | null}
   * @readonly
   */
  readonly answeredAt: string | null;

  /**
   * Property revokedAt
   *
   * @description
   * When the invitation was revoked, ISO 8601; otherwise `null`.
   *
   * @type {string | null}
   * @readonly
   */
  readonly revokedAt: string | null;

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
   * Version of the invitation.
   *
   * @type {number}
   * @readonly
   */
  readonly version: number;
  // #endregion
}

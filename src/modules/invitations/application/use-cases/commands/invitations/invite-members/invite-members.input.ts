/**
 * Interface InviteMembersInput
 *
 * @description
 * A batch of addresses to invite to the current organization with one role.
 */
export interface InviteMembersInput {
  // #region Properties
  /**
   * Property emails
   *
   * @description
   * Addresses to invite; the same address twice counts once.
   *
   * @type {readonly string[]}
   * @readonly
   */
  readonly emails: readonly string[];

  /**
   * Property role
   *
   * @description
   * Role of every address of the batch.
   *
   * @type {'admin' | 'member' | 'guest'}
   * @readonly
   */
  readonly role: 'admin' | 'member' | 'guest';

  /**
   * Property idempotencyKey
   *
   * @description
   * `Idempotency-Key` of the request, 1 to 255 characters, relayed unchanged; absent for a batch
   * sent without one.
   *
   * @type {string | undefined}
   * @readonly
   */
  readonly idempotencyKey?: string;
  // #endregion
}

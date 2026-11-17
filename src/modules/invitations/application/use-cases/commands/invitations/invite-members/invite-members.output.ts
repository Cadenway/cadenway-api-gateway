import type { InvitationOutcome } from '../../../../models/invitations/invitation-outcome.model.js';

/**
 * Interface InviteMembersOutput
 *
 * @description
 * What became of each distinct address of a batch, in its order.
 */
export interface InviteMembersOutput {
  // #region Properties
  /**
   * Property invitations
   *
   * @description
   * One outcome per distinct address.
   *
   * @type {readonly InvitationOutcome[]}
   * @readonly
   */
  readonly invitations: readonly InvitationOutcome[];
  // #endregion
}

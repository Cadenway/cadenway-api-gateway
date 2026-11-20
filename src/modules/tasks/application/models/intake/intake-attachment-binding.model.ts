/** Task-owned proof for an attachment belonging to a live anonymous draft. */
export interface IntakeAttachmentBinding {
  // #region Properties
  /** Internal tenant, publication, allocated attachment and draft expiry. */
  readonly organizationId: string;
  readonly publicationId: string;
  readonly attachmentId: string;
  readonly expiresAt: string;
  // #endregion
}

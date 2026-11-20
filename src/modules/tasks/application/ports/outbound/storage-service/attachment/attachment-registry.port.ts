/** Authorized access and validated transport for task attachments. */
export interface AttachmentRegistry {
  // #region Methods
  /** Checks current task access in Task before a Storage call. */
  authorize(taskKey: string, mode: 'read' | 'write'): Promise<void>;

  /** Lists ready attachments. */
  list(taskKey: string, query: object): Promise<object>;

  /** Reserves an upload using the caller's idempotency key. */
  start(taskKey: string, body: object, key: string | undefined): Promise<object>;

  /** Reads ready metadata. */
  get(taskKey: string, attachmentId: string): Promise<object>;

  /** Completes the uploader's reservation. */
  complete(taskKey: string, attachmentId: string): Promise<object>;

  /** Signs a ready download. */
  download(taskKey: string, attachmentId: string): Promise<object>;

  /** Deletes ready metadata. */
  remove(taskKey: string, attachmentId: string, ifMatch: string | undefined): Promise<void>;
  // #endregion
}

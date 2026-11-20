/** Validated task-service operations for list intake. */
export interface IntakeRegistry {
  // #region Methods
  /** Reads configuration. */
  getConfiguration(listId: string): Promise<{ body: object; version: number }>;
  updateConfiguration(
    listId: string,
    body: object,
    ifMatch: string,
  ): Promise<{ body: object; version: number }>;
  publish(listId: string, ifMatch: string | undefined): Promise<{ body: object; version: number }>;
  disable(listId: string, ifMatch: string | undefined): Promise<{ version: number }>;
  contact(taskKey: string): Promise<object>;
  getPublic(publicKey: string): Promise<object>;
  submit(
    publicKey: string,
    body: object,
    key: string | undefined,
    draftKey?: string,
  ): Promise<object>;
  // #endregion
}

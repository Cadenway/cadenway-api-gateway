/** Validated transport for space and list custom fields. */
export interface CustomFieldRegistry {
  // #region Methods
  /** Lists active space definitions. */
  listSpace(spaceId: string, query: object): Promise<object>;

  /** Creates a definition with an optional idempotency key. */
  create(
    spaceId: string,
    body: object,
    key: string | undefined,
  ): Promise<{ field: object; version: number }>;

  /** Reads a definition and its version. */
  get(spaceId: string, fieldId: string): Promise<{ field: object; version: number }>;

  /** Updates a definition and its version. */
  update(
    spaceId: string,
    fieldId: string,
    body: object,
    ifMatch: string | undefined,
  ): Promise<{ field: object; version: number }>;

  /** Retires a definition. */
  retire(spaceId: string, fieldId: string, ifMatch: string | undefined): Promise<void>;

  /** Lists definitions visible through a list. */
  listList(listId: string, query: object): Promise<object>;
  // #endregion
}

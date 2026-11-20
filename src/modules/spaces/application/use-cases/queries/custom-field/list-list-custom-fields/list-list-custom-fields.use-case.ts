import type { CustomFieldRegistry } from '../../../../ports/outbound/task-service/custom-field/custom-field-registry.port.js';

/** Relays the list-list-custom-fields operation to task-service. */
export class ListListCustomFields {
  // #region Constructor
  /** Binds the custom field port. */
  public constructor(private readonly registry: CustomFieldRegistry) {}
  // #endregion

  // #region Methods
  /** Relays the operation. */
  public execute(listId: string, query: object): Promise<object> {
    return this.registry.listList(listId, query);
  }
  // #endregion
}

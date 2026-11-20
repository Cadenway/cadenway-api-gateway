import type { CustomFieldRegistry } from '../../../../ports/outbound/task-service/custom-field/custom-field-registry.port.js';

/** Relays the list-space-custom-fields operation to task-service. */
export class ListSpaceCustomFields {
  // #region Constructor
  /** Binds the custom field port. */
  public constructor(private readonly registry: CustomFieldRegistry) {}
  // #endregion

  // #region Methods
  /** Relays the operation. */
  public execute(spaceId: string, query: object): Promise<object> {
    return this.registry.listSpace(spaceId, query);
  }
  // #endregion
}

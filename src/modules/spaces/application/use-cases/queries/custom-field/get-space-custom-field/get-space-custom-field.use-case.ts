import type { CustomFieldRegistry } from '../../../../ports/outbound/task-service/custom-field/custom-field-registry.port.js';

/** Relays the get-space-custom-field operation to task-service. */
export class GetSpaceCustomField {
  // #region Constructor
  /** Binds the custom field port. */
  public constructor(private readonly registry: CustomFieldRegistry) {}
  // #endregion

  // #region Methods
  /** Relays the operation. */
  public execute(spaceId: string, fieldId: string): Promise<{ field: object; version: number }> {
    return this.registry.get(spaceId, fieldId);
  }
  // #endregion
}

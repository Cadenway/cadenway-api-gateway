import type { CustomFieldRegistry } from '../../../../ports/outbound/task-service/custom-field/custom-field-registry.port.js';

/** Relays the update-space-custom-field operation to task-service. */
export class UpdateSpaceCustomField {
  // #region Constructor
  /** Binds the custom field port. */
  public constructor(private readonly registry: CustomFieldRegistry) {}
  // #endregion

  // #region Methods
  /** Relays the operation. */
  public execute(
    spaceId: string,
    fieldId: string,
    body: object,
    ifMatch: string | undefined,
  ): Promise<{ field: object; version: number }> {
    return this.registry.update(spaceId, fieldId, body, ifMatch);
  }
  // #endregion
}

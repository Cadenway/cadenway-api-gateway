import type { CustomFieldRegistry } from '../../../../ports/outbound/task-service/custom-field/custom-field-registry.port.js';

/** Relays the create-space-custom-field operation to task-service. */
export class CreateSpaceCustomField {
  // #region Constructor
  /** Binds the custom field port. */
  public constructor(private readonly registry: CustomFieldRegistry) {}
  // #endregion

  // #region Methods
  /** Relays the operation. */
  public execute(
    spaceId: string,
    body: object,
    key: string | undefined,
  ): Promise<{ field: object; version: number }> {
    return this.registry.create(spaceId, body, key);
  }
  // #endregion
}

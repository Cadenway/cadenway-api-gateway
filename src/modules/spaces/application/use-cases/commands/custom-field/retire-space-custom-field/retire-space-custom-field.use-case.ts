import type { CustomFieldRegistry } from '../../../../ports/outbound/task-service/custom-field/custom-field-registry.port.js';

/** Relays the retire-space-custom-field operation to task-service. */
export class RetireSpaceCustomField {
  // #region Constructor
  /** Binds the custom field port. */
  public constructor(private readonly registry: CustomFieldRegistry) {}
  // #endregion

  // #region Methods
  /** Relays the operation. */
  public execute(spaceId: string, fieldId: string, ifMatch: string | undefined): Promise<void> {
    return this.registry.retire(spaceId, fieldId, ifMatch);
  }
  // #endregion
}

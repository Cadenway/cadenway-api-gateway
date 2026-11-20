import type { FactoryProvider } from '@nestjs/common';
import { TaskServiceClient } from '../../../../../../clients/task-service.client.js';
import type { CustomFieldRegistry } from '../../../../application/ports/outbound/task-service/custom-field/custom-field-registry.port.js';
import { createCustomFieldRegistry } from '../../../../infrastructure/adapters/task-service/custom-field/custom-field-registry.adapter.js';
import { CreateSpaceCustomField } from '../../../../application/use-cases/commands/custom-field/create-space-custom-field/create-space-custom-field.use-case.js';
import { UpdateSpaceCustomField } from '../../../../application/use-cases/commands/custom-field/update-space-custom-field/update-space-custom-field.use-case.js';
import { RetireSpaceCustomField } from '../../../../application/use-cases/commands/custom-field/retire-space-custom-field/retire-space-custom-field.use-case.js';
import { ListSpaceCustomFields } from '../../../../application/use-cases/queries/custom-field/list-space-custom-fields/list-space-custom-fields.use-case.js';
import { GetSpaceCustomField } from '../../../../application/use-cases/queries/custom-field/get-space-custom-field/get-space-custom-field.use-case.js';
import { ListListCustomFields } from '../../../../application/use-cases/queries/custom-field/list-list-custom-fields/list-list-custom-fields.use-case.js';

/** Token for the custom field port. */
const CUSTOM_FIELD_REGISTRY = Symbol('CustomFieldRegistry');

/** Custom field use cases and their task-service adapter. */
export const customFieldProviders: readonly FactoryProvider[] = [
  {
    provide: CUSTOM_FIELD_REGISTRY,
    inject: [TaskServiceClient],
    useFactory: createCustomFieldRegistry,
  },
  {
    provide: CreateSpaceCustomField,
    inject: [CUSTOM_FIELD_REGISTRY],
    useFactory: (registry: CustomFieldRegistry): CreateSpaceCustomField =>
      new CreateSpaceCustomField(registry),
  },
  {
    provide: UpdateSpaceCustomField,
    inject: [CUSTOM_FIELD_REGISTRY],
    useFactory: (registry: CustomFieldRegistry): UpdateSpaceCustomField =>
      new UpdateSpaceCustomField(registry),
  },
  {
    provide: RetireSpaceCustomField,
    inject: [CUSTOM_FIELD_REGISTRY],
    useFactory: (registry: CustomFieldRegistry): RetireSpaceCustomField =>
      new RetireSpaceCustomField(registry),
  },
  {
    provide: ListSpaceCustomFields,
    inject: [CUSTOM_FIELD_REGISTRY],
    useFactory: (registry: CustomFieldRegistry): ListSpaceCustomFields =>
      new ListSpaceCustomFields(registry),
  },
  {
    provide: GetSpaceCustomField,
    inject: [CUSTOM_FIELD_REGISTRY],
    useFactory: (registry: CustomFieldRegistry): GetSpaceCustomField =>
      new GetSpaceCustomField(registry),
  },
  {
    provide: ListListCustomFields,
    inject: [CUSTOM_FIELD_REGISTRY],
    useFactory: (registry: CustomFieldRegistry): ListListCustomFields =>
      new ListListCustomFields(registry),
  },
];

import type { TaskServiceClient } from '../../../../../../clients/task-service.client.js';
import type { CustomFieldRegistry } from '../../../../application/ports/outbound/task-service/custom-field/custom-field-registry.port.js';

/** Connects the capability port to the validating technical client. */
export function createCustomFieldRegistry(client: TaskServiceClient): CustomFieldRegistry {
  return {
    listSpace: (spaceId, query) => client.listSpaceCustomFields(spaceId, query),
    create: (spaceId, body, key) => client.createSpaceCustomField(spaceId, body, key),
    get: (spaceId, fieldId) => client.getSpaceCustomField(spaceId, fieldId),
    update: (spaceId, fieldId, body, ifMatch) =>
      client.updateSpaceCustomField(spaceId, fieldId, body, ifMatch),
    retire: (spaceId, fieldId, ifMatch) => client.retireSpaceCustomField(spaceId, fieldId, ifMatch),
    listList: (listId, query) => client.listListCustomFields(listId, query),
  };
}

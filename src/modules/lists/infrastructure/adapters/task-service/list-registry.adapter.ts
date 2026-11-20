import type { ListRegistry } from '../../../application/ports/outbound/task-service/lists/list-registry.port.js';
import type { TaskServiceClient } from '../../../../../clients/task-service.client.js';

/**
 * Function createListRegistryAdapter
 *
 * @description
 * Binds the local port to the validating technical client of task-service, method by method: the
 * client checks each query and body against the internal contract before the call, and each
 * answer after it.
 *
 * @param {TaskServiceClient} client - Technical HTTP client for task-service.
 * @returns {ListRegistry} Local adapter for the capability.
 */
export function createListRegistryAdapter(client: TaskServiceClient): ListRegistry {
  return {
    duplicateList: (listId, body, ifMatch, key) => client.duplicateList(listId, body, ifMatch, key),
    createList: (spaceId, creation, idempotencyKey) =>
      client.createList(spaceId, creation, idempotencyKey),
    listLists: (spaceId, query) => client.listLists(spaceId, query),
    getList: (listId) => client.getList(listId),
    updateList: (listId, patch, ifMatch) => client.updateList(listId, patch, ifMatch),
    deleteList: (listId, ifMatch) => client.deleteList(listId, ifMatch),
    getListCounts: (listId, query) => client.getListCounts(listId, query),
    listListActivity: (listId, query) => client.listListActivity(listId, query),
  };
}

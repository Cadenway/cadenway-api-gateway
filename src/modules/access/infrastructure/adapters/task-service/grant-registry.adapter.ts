import type { GrantRegistry } from '../../../application/ports/outbound/task-service/grants/grant-registry.port.js';
import type { TaskServiceClient } from '../../../../../clients/task-service.client.js';

/**
 * Function createGrantRegistryAdapter
 *
 * @description
 * Binds the local port to the validating technical client of task-service, method by method: the
 * client checks each query and body against the internal contract before the call, and each
 * answer after it, and reads the version of a change from its strong `ETag`.
 *
 * @param {TaskServiceClient} client - Technical HTTP client for task-service.
 * @returns {GrantRegistry} Local adapter for the capability.
 */
export function createGrantRegistryAdapter(client: TaskServiceClient): GrantRegistry {
  return {
    listSpaceGrants: (spaceId, query) => client.listSpaceGrants(spaceId, query),
    setSpaceGrant: (spaceId, userId, change, ifMatch) =>
      client.setSpaceGrant(spaceId, userId, change, ifMatch),
    removeSpaceGrant: (spaceId, userId, ifMatch) =>
      client.removeSpaceGrant(spaceId, userId, ifMatch),
    listListGrants: (listId, query) => client.listListGrants(listId, query),
    setListGrant: (listId, userId, change, ifMatch) =>
      client.setListGrant(listId, userId, change, ifMatch),
    removeListGrant: (listId, userId, ifMatch) => client.removeListGrant(listId, userId, ifMatch),
  };
}

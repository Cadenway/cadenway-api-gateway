import type { SpaceRegistry } from '../../../application/ports/outbound/task-service/spaces/space-registry.port.js';
import type { TaskServiceClient } from '../../../../../clients/task-service.client.js';

/**
 * Function createSpaceRegistryAdapter
 *
 * @description
 * Binds the local port to the validating technical client of task-service, method by method: the
 * client checks each query and body against the internal contract before the call, and each
 * answer after it.
 *
 * @param {TaskServiceClient} client - Technical HTTP client for task-service.
 * @returns {SpaceRegistry} Local adapter for the capability.
 */
export function createSpaceRegistryAdapter(client: TaskServiceClient): SpaceRegistry {
  return {
    listSpaceMilestones: (spaceId, query) => client.listSpaceMilestones(spaceId, query),
    listSpaces: (query) => client.listSpaces(query),
    createSpace: (creation, idempotencyKey) => client.createSpace(creation, idempotencyKey),
    getSpace: (spaceId) => client.getSpace(spaceId),
    updateSpace: (spaceId, patch, ifMatch) => client.updateSpace(spaceId, patch, ifMatch),
    deleteSpace: (spaceId, ifMatch) => client.deleteSpace(spaceId, ifMatch),
    getSpaceOverview: (spaceId, query) => client.getSpaceOverview(spaceId, query),
  };
}

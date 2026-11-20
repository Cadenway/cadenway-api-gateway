import type { TrashRegistry } from '../../../application/ports/outbound/task-service/trash/trash-registry.port.js';
import type { TaskServiceClient } from '../../../../../clients/task-service.client.js';

/**
 * Function createTrashRegistryAdapter
 *
 * @description
 * Binds the local port to the validating technical client of task-service, method by method: the
 * client checks each query and body against the internal contract before the call, and each
 * answer after it.
 *
 * @param {TaskServiceClient} client - Technical HTTP client for task-service.
 * @returns {TrashRegistry} Local adapter for the capability.
 */
export function createTrashRegistryAdapter(client: TaskServiceClient): TrashRegistry {
  return {
    trashTask: (taskKey, body, ifMatch) => client.trashTask(taskKey, body, ifMatch),
    listTrash: (query) => client.listTrash(query),
    restoreTrashEntry: (entryId, body, query) => client.restoreTrashEntry(entryId, body, query),
    purgeTrashEntry: (entryId) => client.purgeTrashEntry(entryId),
    emptyTrash: (body) => client.emptyTrash(body),
  };
}

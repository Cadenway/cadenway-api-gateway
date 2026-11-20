import type { ArchiveRegistry } from '../../../application/ports/outbound/task-service/archives/archive-registry.port.js';
import type { TaskServiceClient } from '../../../../../clients/task-service.client.js';

/**
 * Function createArchiveRegistryAdapter
 *
 * @description
 * Binds the local port to the validating technical client of task-service, method by method: the
 * client checks each query and body against the internal contract before the call, and each
 * answer after it.
 *
 * @param {TaskServiceClient} client - Technical HTTP client for task-service.
 * @returns {ArchiveRegistry} Local adapter for the capability.
 */
export function createArchiveRegistryAdapter(client: TaskServiceClient): ArchiveRegistry {
  return {
    archiveList: (listId, body, ifMatch) => client.archiveList(listId, body, ifMatch),
    unarchiveList: (listId, body, ifMatch) => client.unarchiveList(listId, body, ifMatch),
    archiveTask: (taskKey, body, ifMatch) => client.archiveTask(taskKey, body, ifMatch),
    unarchiveTask: (taskKey, body, ifMatch) => client.unarchiveTask(taskKey, body, ifMatch),
    listArchivedLists: (query) => client.listArchivedLists(query),
    listArchivedTasks: (query) => client.listArchivedTasks(query),
  };
}

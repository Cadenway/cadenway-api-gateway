import type { TaskServiceClient } from '../../../../../../clients/task-service.client.js';
import type { TaskTimeRegistry } from '../../../../application/ports/outbound/task-service/time/task-time-registry.port.js';

/** Binds the local time port to the validating technical client. */
export function createTaskTimeRegistry(client: TaskServiceClient): TaskTimeRegistry {
  return {
    list: (taskKey, query) => client.listTaskTimeEntries(taskKey, query),
    create: (taskKey, body, key) => client.createTaskTimeEntry(taskKey, body, key),
    get: (taskKey, entryId) => client.getTaskTimeEntry(taskKey, entryId),
    remove: (taskKey, entryId) => client.deleteTaskTimeEntry(taskKey, entryId),
    summary: (taskKey) => client.getTaskTimeSummary(taskKey),
    durations: (taskKey) => client.getTaskStatusDurations(taskKey),
  };
}

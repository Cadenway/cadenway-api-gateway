import type { TaskServiceClient } from '../../../../../clients/task-service.client.js';
import type { WatchersRegistry } from '../../../application/ports/outbound/task-service/watchers/watchers-registry.port.js';

/** Binds the port to the validating task-service client. */
export function createWatchersRegistry(client: TaskServiceClient): WatchersRegistry {
  return {
    listTaskWatchers: (taskKey, query) => client.listTaskWatchers(taskKey, query),
    followTaskWatcher: (taskKey, userId, body, ifMatch) =>
      client.followTaskWatcher(taskKey, userId, body, ifMatch),
    unfollowTaskWatcher: (taskKey, userId, ifMatch) =>
      client.unfollowTaskWatcher(taskKey, userId, ifMatch),
  };
}

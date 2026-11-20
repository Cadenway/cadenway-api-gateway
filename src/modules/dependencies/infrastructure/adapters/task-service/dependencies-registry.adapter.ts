import type { TaskServiceClient } from '../../../../../clients/task-service.client.js';
import type { DependenciesRegistry } from '../../../application/ports/outbound/task-service/dependencies/dependencies-registry.port.js';

/** Binds the port to the validating task-service client. */
export function createDependenciesRegistry(client: TaskServiceClient): DependenciesRegistry {
  return {
    listTaskDependencies: (taskKey, query) => client.listTaskDependencies(taskKey, query),
    createTaskDependency: (taskKey, body, ifMatch, key) =>
      client.createTaskDependency(taskKey, body, ifMatch, key),
    getTaskDependency: (taskKey, dependencyId) => client.getTaskDependency(taskKey, dependencyId),
    deleteTaskDependency: (taskKey, dependencyId, ifMatch) =>
      client.deleteTaskDependency(taskKey, dependencyId, ifMatch),
    listDependencyCandidates: (taskKey, query) => client.listDependencyCandidates(taskKey, query),
  };
}

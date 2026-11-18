import type { TaskRegistry } from '../../../application/ports/outbound/task-service/tasks/task-registry.port.js';
import type { TaskServiceClient } from '../../../../../clients/task-service.client.js';

/**
 * Function createTaskRegistryAdapter
 *
 * @description
 * Binds the local port to the validating technical client of task-service, method by method: the
 * client checks each query and body against the internal contract before the call, and each
 * answer after it.
 *
 * @param {TaskServiceClient} client - Technical HTTP client for task-service.
 * @returns {TaskRegistry} Local adapter for the capability.
 */
export function createTaskRegistryAdapter(client: TaskServiceClient): TaskRegistry {
  return {
    listTasks: (listId, query) => client.listTasks(listId, query),
    createTask: (listId, creation, idempotencyKey) =>
      client.createTask(listId, creation, idempotencyKey),
    countTaskGroups: (listId, query) => client.countTaskGroups(listId, query),
    getTask: (taskKey) => client.getTask(taskKey),
    updateTask: (taskKey, patch, ifMatch) => client.updateTask(taskKey, patch, ifMatch),
    listSubtasks: (taskKey, query) => client.listSubtasks(taskKey, query),
    createSubtask: (taskKey, creation, idempotencyKey) =>
      client.createSubtask(taskKey, creation, idempotencyKey),
    addChecklistItem: (taskKey, creation, idempotencyKey) =>
      client.addChecklistItem(taskKey, creation, idempotencyKey),
    updateChecklistItem: (taskKey, checklistItemId, patch, ifMatch) =>
      client.updateChecklistItem(taskKey, checklistItemId, patch, ifMatch),
    assignTask: (taskKey, userId, ifMatch) => client.assignTask(taskKey, userId, ifMatch),
    unassignTask: (taskKey, userId, ifMatch) => client.unassignTask(taskKey, userId, ifMatch),
    addTaskLabel: (taskKey, change, ifMatch) => client.addTaskLabel(taskKey, change, ifMatch),
    removeTaskLabel: (taskKey, change, ifMatch) => client.removeTaskLabel(taskKey, change, ifMatch),
    listTaskActivity: (taskKey, query) => client.listTaskActivity(taskKey, query),
    listLabels: (query) => client.listLabels(query),
    listMyTasks: (userId, query) => client.listMyTasks(userId, query),
    getHome: (userId, query) => client.getHome(userId, query),
  };
}

import type { TaskServiceClient } from '../../../../../clients/task-service.client.js';
import type { CommentsRegistry } from '../../../application/ports/outbound/task-service/comments/comments-registry.port.js';

/** Binds the capability port to the validating task-service client. */
export function createCommentsRegistry(client: TaskServiceClient): CommentsRegistry {
  return {
    listTaskComments: (taskKey, query) => client.listTaskComments(taskKey, query),
    createTaskComment: (taskKey, body, key) => client.createTaskComment(taskKey, body, key),
    getTaskComment: (taskKey, commentId) => client.getTaskComment(taskKey, commentId),
    updateTaskComment: (taskKey, commentId, body, ifMatch) =>
      client.updateTaskComment(taskKey, commentId, body, ifMatch),
    deleteTaskComment: (taskKey, commentId, ifMatch) =>
      client.deleteTaskComment(taskKey, commentId, ifMatch),
    listTaskParticipants: (taskKey, query) => client.listTaskParticipants(taskKey, query),
  };
}

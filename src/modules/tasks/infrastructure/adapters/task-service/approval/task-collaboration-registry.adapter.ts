import type { TaskServiceClient } from '../../../../../../clients/task-service.client.js';
import type { TaskCollaborationRegistry } from '../../../../application/ports/outbound/task-service/approval/task-collaboration-registry.port.js';

/** Binds collaboration operations to the validating task-service client. */
export function createTaskCollaborationRegistry(
  client: TaskServiceClient,
): TaskCollaborationRegistry {
  return {
    getTaskApproval: (key) => client.getTaskApproval(key),
    requestTaskApproval: (key, body, version) => client.requestTaskApproval(key, body, version),
    voteOnTaskApproval: (key, round, body, version) =>
      client.voteOnTaskApproval(key, round, body, version),
    withdrawTaskApprovalVote: (key, round, version) =>
      client.withdrawTaskApprovalVote(key, round, version),
    getOnboarding: (user) => client.getOnboarding(user),
    updateOnboarding: (user, body, version) => client.updateOnboarding(user, body, version),
    updateOnboardingChecklist: (user, body, version) =>
      client.updateOnboardingChecklist(user, body, version),
    finishOnboarding: (user, body, version, key) =>
      client.finishOnboarding(user, body, version, key),
  };
}

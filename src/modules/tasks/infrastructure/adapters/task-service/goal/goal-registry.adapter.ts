import type { TaskServiceClient } from '../../../../../../clients/task-service.client.js';
import type { GoalRegistry } from '../../../../application/ports/outbound/task-service/goal/goal-registry.port.js';

/** Binds the goal port to the generated task-service client. */
export function createGoalRegistry(client: TaskServiceClient): GoalRegistry {
  return {
    listGoals: (query) => client.listGoals(query),
    createGoal: (today, body, key) => client.createGoal(body, { today }, key),
    getGoal: (id, today) => client.getGoal(id, { today }),
    updateGoal: (id, today, body, ifMatch) => client.updateGoal(id, body, { today }, ifMatch),
    deleteGoal: (id, ifMatch) => client.deleteGoal(id, ifMatch),
    createGoalResult: (id, body, ifMatch, key) => client.createGoalResult(id, body, ifMatch, key),
    getGoalResult: (id, resultId) => client.getGoalResult(id, resultId),
    updateGoalResult: (id, resultId, body, ifMatch) =>
      client.updateGoalResult(id, resultId, body, ifMatch),
    deleteGoalResult: async (id, resultId, ifMatch) => {
      await client.deleteGoalResult(id, resultId, ifMatch);
    },
  };
}

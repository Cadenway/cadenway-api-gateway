import type { FactoryProvider } from '@nestjs/common';

import { TaskServiceClient } from '../../../../../../clients/task-service.client.js';
import type { GoalRegistry } from '../../../../application/ports/outbound/task-service/goal/goal-registry.port.js';
import { createGoalRegistry } from '../../../../infrastructure/adapters/task-service/goal/goal-registry.adapter.js';
import { ListGoals } from '../../../../application/use-cases/queries/goal/list-goals/list-goals.use-case.js';
import { CreateGoal } from '../../../../application/use-cases/commands/goal/create-goal/create-goal.use-case.js';
import { GetGoal } from '../../../../application/use-cases/queries/goal/get-goal/get-goal.use-case.js';
import { UpdateGoal } from '../../../../application/use-cases/commands/goal/update-goal/update-goal.use-case.js';
import { DeleteGoal } from '../../../../application/use-cases/commands/goal/delete-goal/delete-goal.use-case.js';
import { CreateGoalResult } from '../../../../application/use-cases/commands/goal/create-goal-result/create-goal-result.use-case.js';
import { GetGoalResult } from '../../../../application/use-cases/queries/goal/get-goal-result/get-goal-result.use-case.js';
import { UpdateGoalResult } from '../../../../application/use-cases/commands/goal/update-goal-result/update-goal-result.use-case.js';
import { DeleteGoalResult } from '../../../../application/use-cases/commands/goal/delete-goal-result/delete-goal-result.use-case.js';

const GOAL_REGISTRY = Symbol('GoalRegistry');

/** Composes the public goal operations. */
export const goalProviders: readonly FactoryProvider[] = [
  { provide: GOAL_REGISTRY, inject: [TaskServiceClient], useFactory: createGoalRegistry },
  {
    provide: ListGoals,
    inject: [GOAL_REGISTRY],
    useFactory: (registry: GoalRegistry): ListGoals => new ListGoals(registry),
  },
  {
    provide: CreateGoal,
    inject: [GOAL_REGISTRY],
    useFactory: (registry: GoalRegistry): CreateGoal => new CreateGoal(registry),
  },
  {
    provide: GetGoal,
    inject: [GOAL_REGISTRY],
    useFactory: (registry: GoalRegistry): GetGoal => new GetGoal(registry),
  },
  {
    provide: UpdateGoal,
    inject: [GOAL_REGISTRY],
    useFactory: (registry: GoalRegistry): UpdateGoal => new UpdateGoal(registry),
  },
  {
    provide: DeleteGoal,
    inject: [GOAL_REGISTRY],
    useFactory: (registry: GoalRegistry): DeleteGoal => new DeleteGoal(registry),
  },
  {
    provide: CreateGoalResult,
    inject: [GOAL_REGISTRY],
    useFactory: (registry: GoalRegistry): CreateGoalResult => new CreateGoalResult(registry),
  },
  {
    provide: GetGoalResult,
    inject: [GOAL_REGISTRY],
    useFactory: (registry: GoalRegistry): GetGoalResult => new GetGoalResult(registry),
  },
  {
    provide: UpdateGoalResult,
    inject: [GOAL_REGISTRY],
    useFactory: (registry: GoalRegistry): UpdateGoalResult => new UpdateGoalResult(registry),
  },
  {
    provide: DeleteGoalResult,
    inject: [GOAL_REGISTRY],
    useFactory: (registry: GoalRegistry): DeleteGoalResult => new DeleteGoalResult(registry),
  },
];

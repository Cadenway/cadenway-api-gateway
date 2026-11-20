import type { FactoryProvider } from '@nestjs/common';
import { TaskServiceClient } from '../../../../../../clients/task-service.client.js';
import type { TaskCollaborationRegistry } from '../../../../application/ports/outbound/task-service/approval/task-collaboration-registry.port.js';
import { createTaskCollaborationRegistry } from '../../../../infrastructure/adapters/task-service/approval/task-collaboration-registry.adapter.js';
import { GetTaskApproval } from '../../../../application/use-cases/queries/approval/get-task-approval/get-task-approval.use-case.js';
import { RequestTaskApproval } from '../../../../application/use-cases/commands/approval/request-task-approval/request-task-approval.use-case.js';
import { VoteOnTaskApproval } from '../../../../application/use-cases/commands/approval/vote-on-task-approval/vote-on-task-approval.use-case.js';
import { WithdrawTaskApprovalVote } from '../../../../application/use-cases/commands/approval/withdraw-task-approval-vote/withdraw-task-approval-vote.use-case.js';
import { GetOnboarding } from '../../../../application/use-cases/queries/onboarding/get-onboarding/get-onboarding.use-case.js';
import { UpdateOnboarding } from '../../../../application/use-cases/commands/onboarding/update-onboarding/update-onboarding.use-case.js';
import { UpdateOnboardingChecklist } from '../../../../application/use-cases/commands/onboarding/update-onboarding-checklist/update-onboarding-checklist.use-case.js';
import { FinishOnboarding } from '../../../../application/use-cases/commands/onboarding/finish-onboarding/finish-onboarding.use-case.js';

const TASK_COLLABORATION = Symbol('TaskCollaborationRegistry');

/** Composes the task collaboration and onboarding routes. */
export const taskCollaborationProviders: readonly FactoryProvider[] = [
  {
    provide: TASK_COLLABORATION,
    inject: [TaskServiceClient],
    useFactory: createTaskCollaborationRegistry,
  },
  {
    provide: GetTaskApproval,
    inject: [TASK_COLLABORATION],
    useFactory: (registry: TaskCollaborationRegistry): GetTaskApproval =>
      new GetTaskApproval(registry),
  },
  {
    provide: RequestTaskApproval,
    inject: [TASK_COLLABORATION],
    useFactory: (registry: TaskCollaborationRegistry): RequestTaskApproval =>
      new RequestTaskApproval(registry),
  },
  {
    provide: VoteOnTaskApproval,
    inject: [TASK_COLLABORATION],
    useFactory: (registry: TaskCollaborationRegistry): VoteOnTaskApproval =>
      new VoteOnTaskApproval(registry),
  },
  {
    provide: WithdrawTaskApprovalVote,
    inject: [TASK_COLLABORATION],
    useFactory: (registry: TaskCollaborationRegistry): WithdrawTaskApprovalVote =>
      new WithdrawTaskApprovalVote(registry),
  },
  {
    provide: GetOnboarding,
    inject: [TASK_COLLABORATION],
    useFactory: (registry: TaskCollaborationRegistry): GetOnboarding => new GetOnboarding(registry),
  },
  {
    provide: UpdateOnboarding,
    inject: [TASK_COLLABORATION],
    useFactory: (registry: TaskCollaborationRegistry): UpdateOnboarding =>
      new UpdateOnboarding(registry),
  },
  {
    provide: UpdateOnboardingChecklist,
    inject: [TASK_COLLABORATION],
    useFactory: (registry: TaskCollaborationRegistry): UpdateOnboardingChecklist =>
      new UpdateOnboardingChecklist(registry),
  },
  {
    provide: FinishOnboarding,
    inject: [TASK_COLLABORATION],
    useFactory: (registry: TaskCollaborationRegistry): FinishOnboarding =>
      new FinishOnboarding(registry),
  },
];

import { Module, type FactoryProvider, type Provider } from '@nestjs/common';

import { ClientsModule } from '../../clients/clients.module.js';
import { TaskServiceClient } from '../../clients/task-service.client.js';
import { AuthModule } from '../auth/auth.module.js';
import { RateLimitModule } from '../rate-limit/rate-limit.module.js';
import type { TaskRegistry } from './application/ports/outbound/task-service/tasks/task-registry.port.js';
import { AssignTask } from './application/use-cases/commands/assignees/assign-task/assign-task.use-case.js';
import { UnassignTask } from './application/use-cases/commands/assignees/unassign-task/unassign-task.use-case.js';
import { AddChecklistItem } from './application/use-cases/commands/checklist/add-checklist-item/add-checklist-item.use-case.js';
import { UpdateChecklistItem } from './application/use-cases/commands/checklist/update-checklist-item/update-checklist-item.use-case.js';
import { AddTaskLabel } from './application/use-cases/commands/labels/add-task-label/add-task-label.use-case.js';
import { RemoveTaskLabel } from './application/use-cases/commands/labels/remove-task-label/remove-task-label.use-case.js';
import { CreateSubtask } from './application/use-cases/commands/subtasks/create-subtask/create-subtask.use-case.js';
import { CreateTask } from './application/use-cases/commands/tasks/create-task/create-task.use-case.js';
import { UpdateTask } from './application/use-cases/commands/tasks/update-task/update-task.use-case.js';
import { ListTaskActivity } from './application/use-cases/queries/activity/list-task-activity/list-task-activity.use-case.js';
import { ListLabels } from './application/use-cases/queries/labels/list-labels/list-labels.use-case.js';
import { GetHome } from './application/use-cases/queries/my-tasks/get-home/get-home.use-case.js';
import { ListMyTasks } from './application/use-cases/queries/my-tasks/list-my-tasks/list-my-tasks.use-case.js';
import { ListSubtasks } from './application/use-cases/queries/subtasks/list-subtasks/list-subtasks.use-case.js';
import { CountTaskGroups } from './application/use-cases/queries/tasks/count-task-groups/count-task-groups.use-case.js';
import { GetTask } from './application/use-cases/queries/tasks/get-task/get-task.use-case.js';
import { ListTasks } from './application/use-cases/queries/tasks/list-tasks/list-tasks.use-case.js';
import { taskDetailCoreSourceProvider } from './composition/providers/adapters/details/task-detail-core-source.provider.js';
import { taskDetailPartsProvider } from './composition/providers/adapters/details/task-detail-parts.provider.js';
import { getTaskDetailProvider } from './composition/providers/use-cases/details/get-task-detail.provider.js';
import { createTaskRegistryAdapter } from './infrastructure/adapters/task-service/task-registry.adapter.js';
import { TasksController } from './presentation/http/controllers/tasks/tasks.controller.js';
import { LabelsController } from './presentation/http/controllers/labels/labels.controller.js';
import { MyTasksController } from './presentation/http/controllers/my-tasks/my-tasks.controller.js';

/**
 * Constant TASK_REGISTRY
 *
 * @description
 * Injection token of the `TaskRegistry` port.
 *
 * @type {unique symbol}
 */
const TASK_REGISTRY: unique symbol = Symbol('TaskRegistry');

/**
 * Constant PROVIDERS
 *
 * @description
 * The port of the capability bound to its adapter, and the use cases bound to the port.
 *
 * @type {readonly FactoryProvider[]}
 */
const PROVIDERS: readonly FactoryProvider[] = [
  {
    provide: TASK_REGISTRY,
    inject: [TaskServiceClient],
    useFactory: createTaskRegistryAdapter,
  },
  {
    provide: AssignTask,
    inject: [TASK_REGISTRY],
    useFactory: (registry: TaskRegistry): AssignTask => new AssignTask(registry),
  },
  {
    provide: UnassignTask,
    inject: [TASK_REGISTRY],
    useFactory: (registry: TaskRegistry): UnassignTask => new UnassignTask(registry),
  },
  {
    provide: AddChecklistItem,
    inject: [TASK_REGISTRY],
    useFactory: (registry: TaskRegistry): AddChecklistItem => new AddChecklistItem(registry),
  },
  {
    provide: UpdateChecklistItem,
    inject: [TASK_REGISTRY],
    useFactory: (registry: TaskRegistry): UpdateChecklistItem => new UpdateChecklistItem(registry),
  },
  {
    provide: AddTaskLabel,
    inject: [TASK_REGISTRY],
    useFactory: (registry: TaskRegistry): AddTaskLabel => new AddTaskLabel(registry),
  },
  {
    provide: RemoveTaskLabel,
    inject: [TASK_REGISTRY],
    useFactory: (registry: TaskRegistry): RemoveTaskLabel => new RemoveTaskLabel(registry),
  },
  {
    provide: CreateSubtask,
    inject: [TASK_REGISTRY],
    useFactory: (registry: TaskRegistry): CreateSubtask => new CreateSubtask(registry),
  },
  {
    provide: CreateTask,
    inject: [TASK_REGISTRY],
    useFactory: (registry: TaskRegistry): CreateTask => new CreateTask(registry),
  },
  {
    provide: UpdateTask,
    inject: [TASK_REGISTRY],
    useFactory: (registry: TaskRegistry): UpdateTask => new UpdateTask(registry),
  },
  {
    provide: ListTaskActivity,
    inject: [TASK_REGISTRY],
    useFactory: (registry: TaskRegistry): ListTaskActivity => new ListTaskActivity(registry),
  },
  {
    provide: ListLabels,
    inject: [TASK_REGISTRY],
    useFactory: (registry: TaskRegistry): ListLabels => new ListLabels(registry),
  },
  {
    provide: GetHome,
    inject: [TASK_REGISTRY],
    useFactory: (registry: TaskRegistry): GetHome => new GetHome(registry),
  },
  {
    provide: ListMyTasks,
    inject: [TASK_REGISTRY],
    useFactory: (registry: TaskRegistry): ListMyTasks => new ListMyTasks(registry),
  },
  {
    provide: ListSubtasks,
    inject: [TASK_REGISTRY],
    useFactory: (registry: TaskRegistry): ListSubtasks => new ListSubtasks(registry),
  },
  {
    provide: CountTaskGroups,
    inject: [TASK_REGISTRY],
    useFactory: (registry: TaskRegistry): CountTaskGroups => new CountTaskGroups(registry),
  },
  {
    provide: GetTask,
    inject: [TASK_REGISTRY],
    useFactory: (registry: TaskRegistry): GetTask => new GetTask(registry),
  },
  {
    provide: ListTasks,
    inject: [TASK_REGISTRY],
    useFactory: (registry: TaskRegistry): ListTasks => new ListTasks(registry),
  },
];

/**
 * Constant DETAIL_PROVIDERS
 *
 * @description
 * The task detail aggregate, assembled in `composition/`: its main part bound to task-service,
 * its secondary parts (none in this version) and the query that composes them.
 *
 * @type {readonly Provider[]}
 */
const DETAIL_PROVIDERS: readonly Provider[] = [
  taskDetailCoreSourceProvider,
  taskDetailPartsProvider,
  getTaskDetailProvider,
];

/**
 * Class TasksModule
 *
 * @description
 * The task routes of `openapi/public/tasks.yaml`, served by task-service, the task detail composed by the gateway. The capability owns its port to task-service and imports the shared authentication and
 * rate-limit guards.
 */
@Module({
  imports: [AuthModule, RateLimitModule, ClientsModule],
  providers: [...PROVIDERS, ...DETAIL_PROVIDERS],
  controllers: [TasksController, LabelsController, MyTasksController],
})
export class TasksModule {}

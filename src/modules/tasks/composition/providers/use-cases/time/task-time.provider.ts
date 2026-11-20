import type { FactoryProvider } from '@nestjs/common';
import { TaskServiceClient } from '../../../../../../clients/task-service.client.js';
import type { TaskTimeRegistry } from '../../../../application/ports/outbound/task-service/time/task-time-registry.port.js';
import { createTaskTimeRegistry } from '../../../../infrastructure/adapters/task-service/time/task-time-registry.adapter.js';
import { CreateTaskTimeEntry } from '../../../../application/use-cases/commands/time/create-task-time-entry/create-task-time-entry.use-case.js';
import { DeleteTaskTimeEntry } from '../../../../application/use-cases/commands/time/delete-task-time-entry/delete-task-time-entry.use-case.js';
import { ListTaskTimeEntries } from '../../../../application/use-cases/queries/time/list-task-time-entries/list-task-time-entries.use-case.js';
import { GetTaskTimeEntry } from '../../../../application/use-cases/queries/time/get-task-time-entry/get-task-time-entry.use-case.js';
import { GetTaskTimeSummary } from '../../../../application/use-cases/queries/time/get-task-time-summary/get-task-time-summary.use-case.js';
import { GetTaskStatusDurations } from '../../../../application/use-cases/queries/time/get-task-status-durations/get-task-status-durations.use-case.js';

/** Token for the task time port. */
const TASK_TIME_REGISTRY = Symbol('TaskTimeRegistry');

/** The time use cases and their task-service adapter. */
export const taskTimeProviders: readonly FactoryProvider[] = [
  { provide: TASK_TIME_REGISTRY, inject: [TaskServiceClient], useFactory: createTaskTimeRegistry },
  {
    provide: CreateTaskTimeEntry,
    inject: [TASK_TIME_REGISTRY],
    useFactory: (registry: TaskTimeRegistry): CreateTaskTimeEntry =>
      new CreateTaskTimeEntry(registry),
  },
  {
    provide: DeleteTaskTimeEntry,
    inject: [TASK_TIME_REGISTRY],
    useFactory: (registry: TaskTimeRegistry): DeleteTaskTimeEntry =>
      new DeleteTaskTimeEntry(registry),
  },
  {
    provide: ListTaskTimeEntries,
    inject: [TASK_TIME_REGISTRY],
    useFactory: (registry: TaskTimeRegistry): ListTaskTimeEntries =>
      new ListTaskTimeEntries(registry),
  },
  {
    provide: GetTaskTimeEntry,
    inject: [TASK_TIME_REGISTRY],
    useFactory: (registry: TaskTimeRegistry): GetTaskTimeEntry => new GetTaskTimeEntry(registry),
  },
  {
    provide: GetTaskTimeSummary,
    inject: [TASK_TIME_REGISTRY],
    useFactory: (registry: TaskTimeRegistry): GetTaskTimeSummary =>
      new GetTaskTimeSummary(registry),
  },
  {
    provide: GetTaskStatusDurations,
    inject: [TASK_TIME_REGISTRY],
    useFactory: (registry: TaskTimeRegistry): GetTaskStatusDurations =>
      new GetTaskStatusDurations(registry),
  },
];

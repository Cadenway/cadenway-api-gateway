import { Module } from '@nestjs/common';
import { ClientsModule } from '../../clients/clients.module.js';
import { TaskServiceClient } from '../../clients/task-service.client.js';
import { AuthModule } from '../auth/auth.module.js';
import { RateLimitModule } from '../rate-limit/rate-limit.module.js';
import type { TaskTemplatesRegistry } from './application/ports/outbound/task-service/templates/task-templates-registry.port.js';
import { createTaskTemplatesRegistry } from './infrastructure/adapters/task-service/task-templates-registry.adapter.js';
import { TaskTemplatesController } from './presentation/http/controllers/task-templates/task-templates.controller.js';
import { ListTaskTemplates } from './application/use-cases/queries/templates/list-task-templates/list-task-templates.use-case.js';
import { CreateTaskTemplate } from './application/use-cases/commands/templates/create-task-template/create-task-template.use-case.js';
import { GetTaskTemplate } from './application/use-cases/queries/templates/get-task-template/get-task-template.use-case.js';
import { DeleteTaskTemplate } from './application/use-cases/commands/templates/delete-task-template/delete-task-template.use-case.js';

/** Injection token for task-service. */
const REGISTRY = Symbol('TaskTemplatesRegistry');

/** Wires the task templates capability. */
@Module({
  imports: [ClientsModule, AuthModule, RateLimitModule],
  controllers: [TaskTemplatesController],
  providers: [
    { provide: REGISTRY, inject: [TaskServiceClient], useFactory: createTaskTemplatesRegistry },
    {
      provide: ListTaskTemplates,
      inject: [REGISTRY],
      useFactory: (registry: TaskTemplatesRegistry): ListTaskTemplates =>
        new ListTaskTemplates(registry),
    },
    {
      provide: CreateTaskTemplate,
      inject: [REGISTRY],
      useFactory: (registry: TaskTemplatesRegistry): CreateTaskTemplate =>
        new CreateTaskTemplate(registry),
    },
    {
      provide: GetTaskTemplate,
      inject: [REGISTRY],
      useFactory: (registry: TaskTemplatesRegistry): GetTaskTemplate =>
        new GetTaskTemplate(registry),
    },
    {
      provide: DeleteTaskTemplate,
      inject: [REGISTRY],
      useFactory: (registry: TaskTemplatesRegistry): DeleteTaskTemplate =>
        new DeleteTaskTemplate(registry),
    },
  ],
})
export class TaskTemplatesModule {}

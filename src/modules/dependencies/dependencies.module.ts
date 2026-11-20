import { Module } from '@nestjs/common';
import { ClientsModule } from '../../clients/clients.module.js';
import { TaskServiceClient } from '../../clients/task-service.client.js';
import { AuthModule } from '../auth/auth.module.js';
import { RateLimitModule } from '../rate-limit/rate-limit.module.js';
import type { DependenciesRegistry } from './application/ports/outbound/task-service/dependencies/dependencies-registry.port.js';
import { createDependenciesRegistry } from './infrastructure/adapters/task-service/dependencies-registry.adapter.js';
import { DependenciesController } from './presentation/http/controllers/dependencies/dependencies.controller.js';
import { ListTaskDependencies } from './application/use-cases/queries/dependencies/list-task-dependencies/list-task-dependencies.use-case.js';
import { CreateTaskDependency } from './application/use-cases/commands/dependencies/create-task-dependency/create-task-dependency.use-case.js';
import { GetTaskDependency } from './application/use-cases/queries/dependencies/get-task-dependency/get-task-dependency.use-case.js';
import { DeleteTaskDependency } from './application/use-cases/commands/dependencies/delete-task-dependency/delete-task-dependency.use-case.js';
import { ListDependencyCandidates } from './application/use-cases/queries/dependencies/list-dependency-candidates/list-dependency-candidates.use-case.js';

/** Injection token for task-service. */
const REGISTRY = Symbol('DependenciesRegistry');

/** Wires the dependency capability. */
@Module({
  imports: [ClientsModule, AuthModule, RateLimitModule],
  controllers: [DependenciesController],
  providers: [
    { provide: REGISTRY, inject: [TaskServiceClient], useFactory: createDependenciesRegistry },
    {
      provide: ListTaskDependencies,
      inject: [REGISTRY],
      useFactory: (registry: DependenciesRegistry): ListTaskDependencies =>
        new ListTaskDependencies(registry),
    },
    {
      provide: CreateTaskDependency,
      inject: [REGISTRY],
      useFactory: (registry: DependenciesRegistry): CreateTaskDependency =>
        new CreateTaskDependency(registry),
    },
    {
      provide: GetTaskDependency,
      inject: [REGISTRY],
      useFactory: (registry: DependenciesRegistry): GetTaskDependency =>
        new GetTaskDependency(registry),
    },
    {
      provide: DeleteTaskDependency,
      inject: [REGISTRY],
      useFactory: (registry: DependenciesRegistry): DeleteTaskDependency =>
        new DeleteTaskDependency(registry),
    },
    {
      provide: ListDependencyCandidates,
      inject: [REGISTRY],
      useFactory: (registry: DependenciesRegistry): ListDependencyCandidates =>
        new ListDependencyCandidates(registry),
    },
  ],
})
export class DependenciesModule {}

import type { FactoryProvider } from '@nestjs/common';

import { IntegrationServiceClient } from '../../../../../../clients/integration-service.client.js';
import { TaskServiceClient } from '../../../../../../clients/task-service.client.js';
import type { TaskGitLinksRegistry } from '../../../../application/ports/outbound/integration-service/git-links/task-git-links-registry.port.js';
import { ListTaskGitLinks } from '../../../../application/use-cases/queries/git-links/list-task-git-links/list-task-git-links.use-case.js';
import { createTaskGitLinksRegistry } from '../../../../infrastructure/adapters/integration-service/git-links/task-git-links-registry.adapter.js';

/** Injection token of the `TaskGitLinksRegistry` port. */
const TASK_GIT_LINKS_REGISTRY: unique symbol = Symbol('TaskGitLinksRegistry');

/** Binds the Git link read of a task to the task-service and integration-service transports. */
export const taskGitLinksProviders: readonly FactoryProvider[] = [
  {
    provide: TASK_GIT_LINKS_REGISTRY,
    inject: [TaskServiceClient, IntegrationServiceClient],
    useFactory: createTaskGitLinksRegistry,
  },
  {
    provide: ListTaskGitLinks,
    inject: [TASK_GIT_LINKS_REGISTRY],
    useFactory: (registry: TaskGitLinksRegistry): ListTaskGitLinks =>
      new ListTaskGitLinks(registry),
  },
];

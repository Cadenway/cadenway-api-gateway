import { Module } from '@nestjs/common';

import { AutomationServiceClient } from '../../clients/automation-service.client.js';
import { ClientsModule } from '../../clients/clients.module.js';
import { OrganizationServiceClient } from '../../clients/organization-service.client.js';
import { TaskServiceClient } from '../../clients/task-service.client.js';
import { AuthModule } from '../auth/auth.module.js';
import { RateLimitModule } from '../rate-limit/rate-limit.module.js';
import type { AutomationRegistry } from './application/ports/outbound/automation-service/rules/automation-registry.port.js';
import { ManageAutomations } from './application/use-cases/commands/automations/manage-automations/manage-automations.use-case.js';
import { ReadAutomations } from './application/use-cases/queries/automations/read-automations/read-automations.use-case.js';
import { createAutomationRegistry } from './infrastructure/adapters/automations/automation-registry.adapter.js';
import { AutomationsController } from './presentation/http/controllers/automations/automations.controller.js';

const AUTOMATION_REGISTRY = Symbol('AUTOMATION_REGISTRY');

/** Composes the public rules and execution history with the signed authority clients. */
@Module({
  imports: [AuthModule, RateLimitModule, ClientsModule],
  controllers: [AutomationsController],
  providers: [
    {
      provide: AUTOMATION_REGISTRY,
      inject: [OrganizationServiceClient, AutomationServiceClient, TaskServiceClient],
      useFactory: createAutomationRegistry,
    },
    {
      provide: ReadAutomations,
      inject: [AUTOMATION_REGISTRY],
      useFactory: (registry: AutomationRegistry) => new ReadAutomations(registry),
    },
    {
      provide: ManageAutomations,
      inject: [AUTOMATION_REGISTRY],
      useFactory: (registry: AutomationRegistry) => new ManageAutomations(registry),
    },
  ],
})
export class AutomationsModule {}

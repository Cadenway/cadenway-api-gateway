import type { FactoryProvider } from '@nestjs/common';
import { TaskServiceClient } from '../../../../../../clients/task-service.client.js';
import type { IntakeRegistry } from '../../../../application/ports/outbound/task-service/intake/intake-registry.port.js';
import { createIntakeRegistry } from '../../../../infrastructure/adapters/task-service/intake/intake-registry.adapter.js';
import { GetIntakeConfiguration } from '../../../../application/use-cases/queries/intake/get-intake-configuration/get-intake-configuration.use-case.js';
import { UpdateIntakeConfiguration } from '../../../../application/use-cases/commands/intake/update-intake-configuration/update-intake-configuration.use-case.js';
import { PublishIntake } from '../../../../application/use-cases/commands/intake/publish-intake/publish-intake.use-case.js';
import { DisableIntake } from '../../../../application/use-cases/commands/intake/disable-intake/disable-intake.use-case.js';
import { GetIntakeContact } from '../../../../application/use-cases/queries/intake/get-intake-contact/get-intake-contact.use-case.js';
import { GetPublicIntake } from '../../../../application/use-cases/queries/intake/get-public-intake/get-public-intake.use-case.js';
import { SubmitPublicIntake } from '../../../../application/use-cases/commands/intake/submit-public-intake/submit-public-intake.use-case.js';

const INTAKE_REGISTRY = Symbol('IntakeRegistry');

/** Composes the authenticated and anonymous intake operations. */
export const intakeProviders: readonly FactoryProvider[] = [
  { provide: INTAKE_REGISTRY, inject: [TaskServiceClient], useFactory: createIntakeRegistry },
  {
    provide: GetIntakeConfiguration,
    inject: [INTAKE_REGISTRY],
    useFactory: (registry: IntakeRegistry): GetIntakeConfiguration =>
      new GetIntakeConfiguration(registry),
  },
  {
    provide: UpdateIntakeConfiguration,
    inject: [INTAKE_REGISTRY],
    useFactory: (registry: IntakeRegistry): UpdateIntakeConfiguration =>
      new UpdateIntakeConfiguration(registry),
  },
  {
    provide: PublishIntake,
    inject: [INTAKE_REGISTRY],
    useFactory: (registry: IntakeRegistry): PublishIntake => new PublishIntake(registry),
  },
  {
    provide: DisableIntake,
    inject: [INTAKE_REGISTRY],
    useFactory: (registry: IntakeRegistry): DisableIntake => new DisableIntake(registry),
  },
  {
    provide: GetIntakeContact,
    inject: [INTAKE_REGISTRY],
    useFactory: (registry: IntakeRegistry): GetIntakeContact => new GetIntakeContact(registry),
  },
  {
    provide: GetPublicIntake,
    inject: [INTAKE_REGISTRY],
    useFactory: (registry: IntakeRegistry): GetPublicIntake => new GetPublicIntake(registry),
  },
  {
    provide: SubmitPublicIntake,
    inject: [INTAKE_REGISTRY],
    useFactory: (registry: IntakeRegistry): SubmitPublicIntake => new SubmitPublicIntake(registry),
  },
];

import type { FactoryProvider } from '@nestjs/common';
import { TaskServiceClient } from '../../../../../../clients/task-service.client.js';
import { StorageServiceClient } from '../../../../../../clients/storage-service.client.js';
import type { IntakeAttachments } from '../../../../application/ports/outbound/storage-service/intake/intake-attachments.port.js';
import type { IntakeRegistry } from '../../../../application/ports/outbound/task-service/intake/intake-registry.port.js';
import { createIntakeAttachments } from '../../../../infrastructure/adapters/storage-service/intake/intake-attachments.adapter.js';
import { createIntakeRegistry } from '../../../../infrastructure/adapters/task-service/intake/intake-registry.adapter.js';
import { GetIntakeConfiguration } from '../../../../application/use-cases/queries/intake/get-intake-configuration/get-intake-configuration.use-case.js';
import { UpdateIntakeConfiguration } from '../../../../application/use-cases/commands/intake/update-intake-configuration/update-intake-configuration.use-case.js';
import { PublishIntake } from '../../../../application/use-cases/commands/intake/publish-intake/publish-intake.use-case.js';
import { DisableIntake } from '../../../../application/use-cases/commands/intake/disable-intake/disable-intake.use-case.js';
import { GetIntakeContact } from '../../../../application/use-cases/queries/intake/get-intake-contact/get-intake-contact.use-case.js';
import { GetPublicIntake } from '../../../../application/use-cases/queries/intake/get-public-intake/get-public-intake.use-case.js';
import { SubmitPublicIntake } from '../../../../application/use-cases/commands/intake/submit-public-intake/submit-public-intake.use-case.js';
import { StartIntakeAttachment } from '../../../../application/use-cases/commands/intake/start-intake-attachment/start-intake-attachment.use-case.js';
import { CompleteIntakeAttachment } from '../../../../application/use-cases/commands/intake/complete-intake-attachment/complete-intake-attachment.use-case.js';
import { ReleaseIntakeAttachment } from '../../../../application/use-cases/commands/intake/release-intake-attachment/release-intake-attachment.use-case.js';

const INTAKE_REGISTRY = Symbol('IntakeRegistry');
const INTAKE_ATTACHMENTS = Symbol('IntakeAttachments');

/** Composes the authenticated and anonymous intake operations. */
export const intakeProviders: readonly FactoryProvider[] = [
  { provide: INTAKE_REGISTRY, inject: [TaskServiceClient], useFactory: createIntakeRegistry },
  {
    provide: INTAKE_ATTACHMENTS,
    inject: [TaskServiceClient, StorageServiceClient],
    useFactory: createIntakeAttachments,
  },
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
  {
    provide: StartIntakeAttachment,
    inject: [INTAKE_ATTACHMENTS],
    useFactory: (attachments: IntakeAttachments): StartIntakeAttachment =>
      new StartIntakeAttachment(attachments),
  },
  {
    provide: CompleteIntakeAttachment,
    inject: [INTAKE_ATTACHMENTS],
    useFactory: (attachments: IntakeAttachments): CompleteIntakeAttachment =>
      new CompleteIntakeAttachment(attachments),
  },
  {
    provide: ReleaseIntakeAttachment,
    inject: [INTAKE_ATTACHMENTS],
    useFactory: (attachments: IntakeAttachments): ReleaseIntakeAttachment =>
      new ReleaseIntakeAttachment(attachments),
  },
];

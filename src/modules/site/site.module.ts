import { Module } from '@nestjs/common';

import { ClientsModule } from '../../clients/clients.module.js';
import { NotificationServiceClient } from '../../clients/notification-service.client.js';
import { AuthModule } from '../auth/auth.module.js';
import { RateLimitModule } from '../rate-limit/rate-limit.module.js';
import type { SiteSubmissions } from './application/ports/outbound/notification-service/forms/site-submissions.port.js';
import { SubmitSiteForm } from './application/use-cases/commands/forms/submit-site-form/submit-site-form.use-case.js';
import { createSiteSubmissions } from './infrastructure/adapters/notification-service/site-submissions.adapter.js';
import { SiteFormsController } from './presentation/http/controllers/forms/site-forms.controller.js';

const SITE_SUBMISSIONS = Symbol('SITE_SUBMISSIONS');

/** Composes anonymous forms with the signed Notification client. */
@Module({
  imports: [AuthModule, RateLimitModule, ClientsModule],
  controllers: [SiteFormsController],
  providers: [
    {
      provide: SITE_SUBMISSIONS,
      inject: [NotificationServiceClient],
      useFactory: createSiteSubmissions,
    },
    {
      provide: SubmitSiteForm,
      inject: [SITE_SUBMISSIONS],
      useFactory: (submissions: SiteSubmissions) => new SubmitSiteForm(submissions),
    },
  ],
})
export class SiteModule {}

import {
  SubmitContactFormBody,
  SubmitContactFormHeader,
  SubscribeToNewsletterBody,
} from '@cadenway/contracts/validators/public/site';
import { ProblemException, ProblemFilter, ZodValidationPipe } from '@cadenway/nest-common';
import {
  Body,
  Catch,
  Controller,
  HttpCode,
  Inject,
  Post,
  Req,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import type { Request } from 'express';
import type { z } from 'zod';

import { toRequestHeader } from '../../../../../../presentation/http/mappers/request-headers.mapper.js';
import { siteFormProblem } from '../../../../../../problems/public-problem.js';
import { CredentialGuard } from '../../../../../auth/public/credential/credential-guard.js';
import { SiteRateLimitGuard } from '../../../../../rate-limit/public/requests/site-rate-limit-guard.js';
import { SubmitSiteForm } from '../../../../application/use-cases/commands/forms/submit-site-form/submit-site-form.use-case.js';
import { relaySiteSubmission } from '../../mappers/forms/site-submission-relay.mapper.js';

/** Rejects non-JSON content and query parameters before forwarding a public form. */
function validateRequest(request: Request): void {
  if (request.is('application/json') !== 'application/json' || Object.keys(request.query).length) {
    throw new ProblemException({ status: 400, code: 'request.invalid' });
  }
}

/** Uses the Site contract's titles for the shared error codes. */
@Catch()
export class SiteFormsProblemFilter extends ProblemFilter {
  // #region Methods
  /** Delegates the Site problem to the shared serializer. */
  public override catch(exception: unknown, host: ArgumentsHost): void {
    if (
      exception instanceof ProblemException &&
      exception.problem.status === 400 &&
      exception.problem.code === 'request.invalid' &&
      Array.isArray(exception.problem.details?.issues)
    ) {
      const issues: unknown[] = exception.problem.details.issues;
      const safePaths = new Set(['', 'email', 'subject', 'message', 'Idempotency-Key']);
      const sanitized = issues.map((issue: unknown) => {
        if (typeof issue !== 'object' || issue === null) {
          return { in: 'body', path: '', code: 'invalid_format' };
        }
        const entry = issue as Record<string, unknown>;
        return {
          in: entry.in === 'header' ? 'header' : 'body',
          path: typeof entry.path === 'string' && safePaths.has(entry.path) ? entry.path : '',
          code: typeof entry.code === 'string' ? entry.code : 'invalid_format',
        };
      });
      super.catch(
        siteFormProblem(
          new ProblemException({
            status: 400,
            code: 'request.invalid',
            detail: 'The request does not match its contract.',
            details: { issues: sanitized },
          }),
        ),
        host,
      );
      return;
    }
    super.catch(siteFormProblem(exception), host);
  }
  // #endregion
}

/** Exposes anonymous, independently rate-limited site forms. */
@Controller('v1')
@UseGuards(CredentialGuard, SiteRateLimitGuard)
@UseFilters(SiteFormsProblemFilter)
export class SiteFormsController {
  // #region Constructor
  /** Binds public forms to their application use case. */
  public constructor(@Inject(SubmitSiteForm) private readonly submit: SubmitSiteForm) {}
  // #endregion

  // #region Methods
  /** Accepts a support message and its stable retry key. */
  @Post('contact-submissions')
  @HttpCode(202)
  @CredentialGuard.requires({ operationId: 'submitContactForm', security: [], organization: false })
  @SiteRateLimitGuard.operation('contact')
  public async contact(
    @Req() request: Request,
    @Body(new ZodValidationPipe(SubmitContactFormBody))
    body: z.output<typeof SubmitContactFormBody>,
  ): Promise<void> {
    validateRequest(request);
    const values = request.headersDistinct['idempotency-key'];
    const key = toRequestHeader(
      'Idempotency-Key',
      SubmitContactFormHeader.shape['Idempotency-Key'],
      values?.length === 1 ? values[0] : values,
    );
    await relaySiteSubmission('contact', () => this.submit.execute({ kind: 'contact', body, key }));
  }

  /** Accepts a newsletter signup without revealing any previous subscription. */
  @Post('newsletter-subscriptions')
  @HttpCode(202)
  @CredentialGuard.requires({
    operationId: 'subscribeToNewsletter',
    security: [],
    organization: false,
  })
  @SiteRateLimitGuard.operation('newsletter')
  public async newsletter(
    @Req() request: Request,
    @Body(new ZodValidationPipe(SubscribeToNewsletterBody))
    body: z.output<typeof SubscribeToNewsletterBody>,
  ): Promise<void> {
    validateRequest(request);
    await relaySiteSubmission('newsletter', () =>
      this.submit.execute({ kind: 'newsletter', body }),
    );
  }
  // #endregion
}

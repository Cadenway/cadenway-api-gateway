import {
  FinishOnboardingBody,
  FinishOnboardingHeader,
  FinishOnboardingResponse,
  GetOnboardingResponse,
  UpdateOnboardingBody,
  UpdateOnboardingChecklistBody,
  UpdateOnboardingChecklistResponse,
  UpdateOnboardingResponse,
} from '@cadenway/contracts/validators/public/tasks';
import { formatEtag } from '@cadenway/nest-common';
import {
  Controller,
  Get,
  Headers,
  HttpCode,
  Inject,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { z } from 'zod';

import { conformBody, outsideContract } from '../../../../../../problems/upstream-answer.js';
import {
  relayProblems,
  type AcceptedProblems,
} from '../../../../../../problems/upstream-problem.js';
import { RequiredBody } from '../../../../../../presentation/http/mappers/request-body.mapper.js';
import {
  toIfMatchHeader,
  toRequestHeader,
} from '../../../../../../presentation/http/mappers/request-headers.mapper.js';
import { verifiedCredentialOf } from '../../../../../../presentation/http/session/request-session.js';
import { CredentialGuard } from '../../../../../auth/public/credential/credential-guard.js';
import { RateLimitGuard } from '../../../../../rate-limit/public/requests/rate-limit-guard.js';
import { GetOnboarding } from '../../../../application/use-cases/queries/onboarding/get-onboarding/get-onboarding.use-case.js';
import { UpdateOnboarding } from '../../../../application/use-cases/commands/onboarding/update-onboarding/update-onboarding.use-case.js';
import { UpdateOnboardingChecklist } from '../../../../application/use-cases/commands/onboarding/update-onboarding-checklist/update-onboarding-checklist.use-case.js';
import { FinishOnboarding } from '../../../../application/use-cases/commands/onboarding/finish-onboarding/finish-onboarding.use-case.js';

const READ: AcceptedProblems = { 400: ['request.invalid'], 404: ['organization.not-found'] };
const UPDATE: AcceptedProblems = {
  ...READ,
  409: ['onboarding.wizard-closed'],
  412: ['request.version-mismatch'],
};
const CHECKLIST: AcceptedProblems = {
  ...READ,
  409: ['onboarding.checklist-unavailable'],
  412: ['request.version-mismatch'],
};
const FINISH: AcceptedProblems = {
  ...READ,
  403: ['organization.role-forbidden'],
  409: ['onboarding.wizard-closed', 'space.prefix-taken', 'idempotency.request-in-progress'],
  412: ['request.version-mismatch'],
  422: ['idempotency.key-reused'],
};

/** Gets the user authenticated by the credential guard. */
function actorOf(request: Request): string {
  const credential = verifiedCredentialOf(request);
  if (credential === undefined) throw new Error('The route runs without a verified credential.');
  return credential.userId;
}

/** First-launch progress of the authenticated organization member. */
@Controller('v1/me/onboarding')
@UseGuards(CredentialGuard, RateLimitGuard)
export class OnboardingController {
  // #region Constructor
  /** Binds the onboarding use cases. */
  public constructor(
    @Inject(GetOnboarding) private readonly reading: GetOnboarding,
    @Inject(UpdateOnboarding) private readonly updating: UpdateOnboarding,
    @Inject(UpdateOnboardingChecklist) private readonly checklist: UpdateOnboardingChecklist,
    @Inject(FinishOnboarding) private readonly finishing: FinishOnboarding,
  ) {}
  // #endregion

  // #region Methods
  /** Reads the caller's wizard and checklist. */
  @Get()
  @CredentialGuard.requires({
    operationId: 'getOnboarding',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:read'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async get(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof GetOnboardingResponse>> {
    const result = await relayProblems(READ, () => this.reading.execute(actorOf(request)));
    const body = conformBody('task-service', 'getOnboarding', GetOnboardingResponse, result.body);
    if (body.version !== result.version)
      throw outsideContract('task-service', 'getOnboarding', 'an inconsistent ETag');
    response.setHeader('ETag', formatEtag(result.version));
    return body;
  }

  /** Saves or dismisses the wizard. */
  @Patch()
  @CredentialGuard.requires({
    operationId: 'updateOnboarding',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async update(
    @Req() request: Request,
    @RequiredBody(UpdateOnboardingBody) input: z.output<typeof UpdateOnboardingBody>,
    @Headers('if-match') header: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof UpdateOnboardingResponse>> {
    const ifMatch = toIfMatchHeader(header);
    const result = await relayProblems(UPDATE, () =>
      this.updating.execute(actorOf(request), input, ifMatch),
    );
    const body = conformBody(
      'task-service',
      'updateOnboarding',
      UpdateOnboardingResponse,
      result.body,
    );
    if (body.version !== result.version)
      throw outsideContract('task-service', 'updateOnboarding', 'an inconsistent ETag');
    response.setHeader('ETag', formatEtag(result.version));
    return body;
  }

  /** Records checklist presentation and completed actions. */
  @Patch('checklist')
  @CredentialGuard.requires({
    operationId: 'updateOnboardingChecklist',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async updateChecklist(
    @Req() request: Request,
    @RequiredBody(UpdateOnboardingChecklistBody)
    input: z.output<typeof UpdateOnboardingChecklistBody>,
    @Headers('if-match') header: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof UpdateOnboardingChecklistResponse>> {
    const ifMatch = toIfMatchHeader(header);
    const result = await relayProblems(CHECKLIST, () =>
      this.checklist.execute(actorOf(request), input, ifMatch),
    );
    const body = conformBody(
      'task-service',
      'updateOnboardingChecklist',
      UpdateOnboardingChecklistResponse,
      result.body,
    );
    if (body.version !== result.version)
      throw outsideContract('task-service', 'updateOnboardingChecklist', 'an inconsistent ETag');
    response.setHeader('ETag', formatEtag(result.version));
    return body;
  }

  /** Provisions the selected space and records the caller's finished wizard. */
  @Post('finish')
  @HttpCode(201)
  @CredentialGuard.requires({
    operationId: 'finishOnboarding',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async finish(
    @Req() request: Request,
    @RequiredBody(FinishOnboardingBody) input: z.output<typeof FinishOnboardingBody>,
    @Headers('if-match') header: string | undefined,
    @Headers('idempotency-key') key: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof FinishOnboardingResponse>> {
    const ifMatch = toIfMatchHeader(header);
    const idempotencyKey = toRequestHeader(
      'Idempotency-Key',
      FinishOnboardingHeader.shape['Idempotency-Key'],
      key,
    );
    const result = await relayProblems(FINISH, () =>
      this.finishing.execute(actorOf(request), input, ifMatch, idempotencyKey),
    );
    const body = conformBody(
      'task-service',
      'finishOnboarding',
      FinishOnboardingResponse,
      result.body,
    );
    if (body.version !== result.version || body.provisioning === null)
      throw outsideContract(
        'task-service',
        'finishOnboarding',
        'an inconsistent ETag or missing space',
      );
    response.setHeader('ETag', formatEtag(result.version));
    response.setHeader('Location', `/v1/spaces/${body.provisioning.spaceId}`);
    return body;
  }
  // #endregion
}

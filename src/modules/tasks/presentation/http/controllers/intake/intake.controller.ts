import {
  DisableIntakeFormParams,
  GetIntakeFormConfigurationParams,
  GetIntakeFormConfigurationResponse,
  GetPublicIntakeFormParams,
  GetPublicIntakeFormResponse,
  GetTaskIntakeContactParams,
  GetTaskIntakeContactResponse,
  PublishIntakeFormParams,
  PublishIntakeFormResponse,
  SubmitPublicIntakeFormBody,
  SubmitPublicIntakeFormHeader,
  SubmitPublicIntakeFormParams,
  SubmitPublicIntakeFormResponse,
  UpdateIntakeFormConfigurationBody,
  UpdateIntakeFormConfigurationHeader,
  UpdateIntakeFormConfigurationParams,
  UpdateIntakeFormConfigurationResponse,
} from '@cadenway/contracts/validators/public/intake';
import { formatEtag, ZodValidationPipe } from '@cadenway/nest-common';
import {
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Inject,
  Injectable,
  Param,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { z } from 'zod';

import { conformBody, outsideContract } from '../../../../../../problems/upstream-answer.js';
import { publicProblem } from '../../../../../../problems/public-problem.js';
import {
  relayProblems,
  type AcceptedProblems,
} from '../../../../../../problems/upstream-problem.js';
import { RequiredBody } from '../../../../../../presentation/http/mappers/request-body.mapper.js';
import {
  toIfMatchHeader,
  toRequestHeader,
} from '../../../../../../presentation/http/mappers/request-headers.mapper.js';
import { CredentialGuard } from '../../../../../auth/public/credential/credential-guard.js';
import { IntakeRateLimitGuard } from '../../../../../rate-limit/public/requests/intake-rate-limit-guard.js';
import { RateLimitGuard } from '../../../../../rate-limit/public/requests/rate-limit-guard.js';
import { GetIntakeConfiguration } from '../../../../application/use-cases/queries/intake/get-intake-configuration/get-intake-configuration.use-case.js';
import { UpdateIntakeConfiguration } from '../../../../application/use-cases/commands/intake/update-intake-configuration/update-intake-configuration.use-case.js';
import { PublishIntake } from '../../../../application/use-cases/commands/intake/publish-intake/publish-intake.use-case.js';
import { DisableIntake } from '../../../../application/use-cases/commands/intake/disable-intake/disable-intake.use-case.js';
import { GetIntakeContact } from '../../../../application/use-cases/queries/intake/get-intake-contact/get-intake-contact.use-case.js';
import { GetPublicIntake } from '../../../../application/use-cases/queries/intake/get-public-intake/get-public-intake.use-case.js';
import { SubmitPublicIntake } from '../../../../application/use-cases/commands/intake/submit-public-intake/submit-public-intake.use-case.js';

const READ: AcceptedProblems = {
  400: ['request.invalid'],
  403: ['access.role-insufficient'],
  404: ['list.not-found', 'organization.not-found'],
};
const WRITE: AcceptedProblems = {
  ...READ,
  409: ['intake-form.list-archived'],
  412: ['request.version-mismatch'],
  422: ['intake-form.defaults-invalid'],
};
const DISABLE: AcceptedProblems = {
  ...READ,
  412: ['request.version-mismatch'],
};
const CONTACT: AcceptedProblems = {
  400: ['request.invalid'],
  403: ['access.role-insufficient'],
  404: ['task.not-found', 'task.trashed', 'organization.not-found'],
};
const PUBLIC_READ: AcceptedProblems = { 404: ['intake-form.not-found'] };
const PUBLIC_SUBMIT: AcceptedProblems = {
  ...PUBLIC_READ,
  400: ['request.invalid'],
  409: ['idempotency.request-in-progress'],
  422: ['idempotency.key-reused'],
};

/** Rejects malformed publication keys after the anonymous address has been counted. */
@Injectable()
export class IntakePublicationKeyGuard implements CanActivate {
  // #region Methods
  /** Applies the same key shape as task-service without exposing the supplied key. */
  public canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (
      typeof request.params.publicKey === 'string' &&
      /^[A-Za-z0-9_-]{43}$/.test(request.params.publicKey)
    ) {
      return true;
    }
    context.switchToHttp().getResponse<Response>().setHeader('Cache-Control', 'no-store');
    throw publicProblem({ status: 404, code: 'intake-form.not-found' });
  }
  // #endregion
}

/** Authenticated configuration and private contact routes. */
@Controller('v1')
@UseGuards(CredentialGuard, RateLimitGuard)
export class IntakeController {
  // #region Constructor
  /** Binds the intake use cases. */
  public constructor(
    @Inject(GetIntakeConfiguration) private readonly reading: GetIntakeConfiguration,
    @Inject(UpdateIntakeConfiguration) private readonly updating: UpdateIntakeConfiguration,
    @Inject(PublishIntake) private readonly publishing: PublishIntake,
    @Inject(DisableIntake) private readonly disabling: DisableIntake,
    @Inject(GetIntakeContact) private readonly contacts: GetIntakeContact,
  ) {}
  // #endregion

  // #region Methods
  /** Reads the list's form configuration. */
  @Get('lists/:listId/intake-form')
  @CredentialGuard.requires({
    operationId: 'getIntakeFormConfiguration',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:read'] }],
    organization: true,
  })
  public async getConfiguration(
    @Param(new ZodValidationPipe(GetIntakeFormConfigurationParams))
    params: z.output<typeof GetIntakeFormConfigurationParams>,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof GetIntakeFormConfigurationResponse>> {
    response.setHeader('Cache-Control', 'no-store');
    const result = await relayProblems(READ, () => this.reading.execute(params.listId));
    const body = conformBody(
      'task-service',
      'getIntakeFormConfiguration',
      GetIntakeFormConfigurationResponse,
      result.body,
    );
    if (body.version !== result.version)
      throw outsideContract('task-service', 'getIntakeFormConfiguration', 'an inconsistent ETag');
    response.setHeader('ETag', formatEtag(result.version));
    return body;
  }

  /** Updates the configuration under its current version. */
  @Patch('lists/:listId/intake-form')
  @CredentialGuard.requires({
    operationId: 'updateIntakeFormConfiguration',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
  })
  public async updateConfiguration(
    @Param(new ZodValidationPipe(UpdateIntakeFormConfigurationParams))
    params: z.output<typeof UpdateIntakeFormConfigurationParams>,
    @RequiredBody(UpdateIntakeFormConfigurationBody)
    body: z.output<typeof UpdateIntakeFormConfigurationBody>,
    @Headers('if-match') header: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof UpdateIntakeFormConfigurationResponse>> {
    response.setHeader('Cache-Control', 'no-store');
    const ifMatch = toRequestHeader(
      'If-Match',
      UpdateIntakeFormConfigurationHeader.shape['If-Match'],
      header,
    );
    const result = await relayProblems(WRITE, () =>
      this.updating.execute(params.listId, body, ifMatch),
    );
    const updated = conformBody(
      'task-service',
      'updateIntakeFormConfiguration',
      UpdateIntakeFormConfigurationResponse,
      result.body,
    );
    if (updated.version !== result.version)
      throw outsideContract(
        'task-service',
        'updateIntakeFormConfiguration',
        'an inconsistent ETag',
      );
    response.setHeader('ETag', formatEtag(result.version));
    return updated;
  }

  /** Publishes the form with current task defaults. */
  @Post('lists/:listId/intake-form/publish')
  @HttpCode(200)
  @CredentialGuard.requires({
    operationId: 'publishIntakeForm',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
  })
  public async publish(
    @Param(new ZodValidationPipe(PublishIntakeFormParams))
    params: z.output<typeof PublishIntakeFormParams>,
    @Headers('if-match') header: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof PublishIntakeFormResponse>> {
    response.setHeader('Cache-Control', 'no-store');
    const result = await relayProblems(WRITE, () =>
      this.publishing.execute(params.listId, toIfMatchHeader(header)),
    );
    const body = conformBody(
      'task-service',
      'publishIntakeForm',
      PublishIntakeFormResponse,
      result.body,
    );
    if (body.version !== result.version)
      throw outsideContract('task-service', 'publishIntakeForm', 'an inconsistent ETag');
    response.setHeader('ETag', formatEtag(result.version));
    return body;
  }

  /** Revokes a publication without deleting its draft. */
  @Delete('lists/:listId/intake-form/publication')
  @HttpCode(204)
  @CredentialGuard.requires({
    operationId: 'disableIntakeForm',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
  })
  public async disable(
    @Param(new ZodValidationPipe(DisableIntakeFormParams))
    params: z.output<typeof DisableIntakeFormParams>,
    @Headers('if-match') header: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const result = await relayProblems(DISABLE, () =>
      this.disabling.execute(params.listId, toIfMatchHeader(header)),
    );
    response.setHeader('ETag', formatEtag(result.version));
  }

  /** Reads a separately stored applicant contact. */
  @Get('tasks/:taskKey/intake-contact')
  @CredentialGuard.requires({
    operationId: 'getTaskIntakeContact',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:read'] }],
    organization: true,
  })
  public async contact(
    @Param(new ZodValidationPipe(GetTaskIntakeContactParams))
    params: z.output<typeof GetTaskIntakeContactParams>,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof GetTaskIntakeContactResponse>> {
    response.setHeader('Cache-Control', 'no-store');
    return conformBody(
      'task-service',
      'getTaskIntakeContact',
      GetTaskIntakeContactResponse,
      await relayProblems(CONTACT, () => this.contacts.execute(params.taskKey)),
    );
  }
  // #endregion
}

/** Applicant routes, independent of any supplied session or token. */
@Controller('v1/intake-forms')
@UseGuards(CredentialGuard, IntakeRateLimitGuard, IntakePublicationKeyGuard)
export class PublicIntakeController {
  // #region Constructor
  /** Binds the intake use cases. */
  public constructor(
    @Inject(GetPublicIntake) private readonly reading: GetPublicIntake,
    @Inject(SubmitPublicIntake) private readonly submitting: SubmitPublicIntake,
  ) {}
  // #endregion

  // #region Methods
  /** Reads the active publication. */
  @Get(':publicKey')
  @CredentialGuard.requires({
    operationId: 'getPublicIntakeForm',
    security: [],
    organization: false,
  })
  public async get(
    @Param(new ZodValidationPipe(GetPublicIntakeFormParams))
    params: z.output<typeof GetPublicIntakeFormParams>,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof GetPublicIntakeFormResponse>> {
    response.setHeader('Cache-Control', 'no-store');
    return conformBody(
      'task-service',
      'getPublicIntakeForm',
      GetPublicIntakeFormResponse,
      await relayProblems(PUBLIC_READ, () => this.reading.execute(params.publicKey), [404]),
    );
  }

  /** Submits a request to an active publication. */
  @Post(':publicKey/submissions')
  @HttpCode(200)
  @CredentialGuard.requires({
    operationId: 'submitPublicIntakeForm',
    security: [],
    organization: false,
  })
  public async submit(
    @Param(new ZodValidationPipe(SubmitPublicIntakeFormParams))
    params: z.output<typeof SubmitPublicIntakeFormParams>,
    @RequiredBody(SubmitPublicIntakeFormBody) body: z.output<typeof SubmitPublicIntakeFormBody>,
    @Headers('idempotency-key') header: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof SubmitPublicIntakeFormResponse>> {
    response.setHeader('Cache-Control', 'no-store');
    const key = toRequestHeader(
      'Idempotency-Key',
      SubmitPublicIntakeFormHeader.shape['Idempotency-Key'],
      header,
    );
    return conformBody(
      'task-service',
      'submitPublicIntakeForm',
      SubmitPublicIntakeFormResponse,
      await relayProblems(
        PUBLIC_SUBMIT,
        () => this.submitting.execute(params.publicKey, body, key),
        [404],
      ),
    );
  }
  // #endregion
}

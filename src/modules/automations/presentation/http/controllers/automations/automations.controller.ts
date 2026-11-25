import {
  CreateAutomationRuleBody,
  CreateAutomationRuleHeader,
  CreateAutomationRuleResponse,
  DeleteAutomationRuleHeader,
  DeleteAutomationRuleParams,
  ListAutomationRulesQueryParams,
  ListAutomationRulesResponse,
  ListRecentAutomationRunsResponse,
  UpdateAutomationRuleBody,
  UpdateAutomationRuleHeader,
  UpdateAutomationRuleParams,
  UpdateAutomationRuleResponse,
} from '@cadenway/contracts/validators/public/automations';
import { formatEtag, ZodValidationPipe } from '@cadenway/nest-common';
import {
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';

import { RequiredBody } from '../../../../../../presentation/http/mappers/request-body.mapper.js';
import { toRequestHeader } from '../../../../../../presentation/http/mappers/request-headers.mapper.js';
import { conformBody } from '../../../../../../problems/upstream-answer.js';
import {
  relayProblems,
  type AcceptedProblems,
} from '../../../../../../problems/upstream-problem.js';
import { CredentialGuard } from '../../../../../auth/public/credential/credential-guard.js';
import { RateLimitGuard } from '../../../../../rate-limit/public/requests/rate-limit-guard.js';
import { ManageAutomations } from '../../../../application/use-cases/commands/automations/manage-automations/manage-automations.use-case.js';
import { ReadAutomations } from '../../../../application/use-cases/queries/automations/read-automations/read-automations.use-case.js';

const READ: AcceptedProblems = {
  400: ['request.invalid'],
  403: ['organization.role-forbidden'],
  404: ['organization.not-found'],
};
const CREATE: AcceptedProblems = {
  ...READ,
  409: ['idempotency.request-in-progress'],
  422: ['automation.recipient-ineligible', 'idempotency.key-reused'],
};
const CHANGE: AcceptedProblems = {
  ...READ,
  404: ['organization.not-found', 'automation.rule-not-found'],
  412: ['request.version-mismatch'],
};

/** Session routes for managing rules and reading visible recent executions. */
@Controller('v1')
@UseGuards(CredentialGuard, RateLimitGuard)
export class AutomationsController {
  // #region Constructor
  /** Binds the authorized rule and history operations. */
  public constructor(
    @Inject(ReadAutomations) private readonly read: ReadAutomations,
    @Inject(ManageAutomations) private readonly manage: ManageAutomations,
  ) {}
  // #endregion

  // #region Methods
  /** Lists rules for the authenticated organization. */
  @Get('automations')
  @CredentialGuard.requires({
    operationId: 'listAutomationRules',
    security: [{ sessionCookie: [] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async list(
    @Query(new ZodValidationPipe(ListAutomationRulesQueryParams.strict()))
    query: z.output<typeof ListAutomationRulesQueryParams>,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof ListAutomationRulesResponse>> {
    const result = conformBody(
      'automation-service',
      'listAutomationRules',
      ListAutomationRulesResponse,
      await relayProblems(READ, () => this.read.execute({ kind: 'rules', query })),
    );
    response.setHeader('Cache-Control', 'private, no-store');
    return result;
  }

  /** Creates a rule and exposes its public location and current version. */
  @Post('automations')
  @CredentialGuard.requires({
    operationId: 'createAutomationRule',
    security: [{ sessionCookie: [] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async create(
    @RequiredBody(CreateAutomationRuleBody) body: z.output<typeof CreateAutomationRuleBody>,
    @Headers('idempotency-key') header: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof CreateAutomationRuleResponse>> {
    const key = toRequestHeader(
      'Idempotency-Key',
      CreateAutomationRuleHeader.shape['Idempotency-Key'],
      header,
    );
    const result = conformBody(
      'automation-service',
      'createAutomationRule',
      CreateAutomationRuleResponse,
      await relayProblems(CREATE, () => this.manage.execute({ kind: 'create', body, key }), [422]),
    );
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('Location', `/v1/automations/${result.ruleId}`);
    response.setHeader('ETag', formatEtag(result.version));
    return result;
  }

  /** Changes whether a rule can react to events. */
  @Patch('automations/:ruleId')
  @CredentialGuard.requires({
    operationId: 'updateAutomationRule',
    security: [{ sessionCookie: [] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async update(
    @Param(new ZodValidationPipe(UpdateAutomationRuleParams))
    params: z.output<typeof UpdateAutomationRuleParams>,
    @RequiredBody(UpdateAutomationRuleBody) body: z.output<typeof UpdateAutomationRuleBody>,
    @Headers('if-match') header: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof UpdateAutomationRuleResponse>> {
    const ifMatch = toRequestHeader(
      'If-Match',
      UpdateAutomationRuleHeader.shape['If-Match'],
      header,
    );
    const result = conformBody(
      'automation-service',
      'updateAutomationRule',
      UpdateAutomationRuleResponse,
      await relayProblems(CHANGE, () =>
        this.manage.execute({ kind: 'update', ruleId: params.ruleId, body, ifMatch }),
      ),
    );
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('ETag', formatEtag(result.version));
    return result;
  }

  /** Deletes a rule with an optional version precondition. */
  @Delete('automations/:ruleId')
  @HttpCode(204)
  @CredentialGuard.requires({
    operationId: 'deleteAutomationRule',
    security: [{ sessionCookie: [] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async delete(
    @Param(new ZodValidationPipe(DeleteAutomationRuleParams))
    params: z.output<typeof DeleteAutomationRuleParams>,
    @Headers('if-match') header: string | undefined,
  ): Promise<void> {
    const ifMatch = toRequestHeader(
      'If-Match',
      DeleteAutomationRuleHeader.shape['If-Match'],
      header,
    );
    await relayProblems(CHANGE, () =>
      this.manage.execute({ kind: 'delete', ruleId: params.ruleId, ifMatch }),
    );
  }

  /** Returns only the current caller's visible recent executions. */
  @Get('automation-runs')
  @CredentialGuard.requires({
    operationId: 'listRecentAutomationRuns',
    security: [{ sessionCookie: [] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async runs(
    @Query(new ZodValidationPipe(z.strictObject({}))) _query: object,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof ListRecentAutomationRunsResponse>> {
    const result = conformBody(
      'automation-service',
      'listRecentAutomationRuns',
      ListRecentAutomationRunsResponse,
      await relayProblems(READ, () => this.read.execute({ kind: 'runs' })),
    );
    response.setHeader('Cache-Control', 'private, no-store');
    return result;
  }
  // #endregion
}

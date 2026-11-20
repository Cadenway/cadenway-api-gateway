import {
  DuplicateListBody,
  DuplicateListHeader,
  DuplicateListParams,
  DuplicateListResponse,
} from '@cadenway/contracts/validators/public/lists';
import { formatEtag, ZodValidationPipe } from '@cadenway/nest-common';
import { Controller, Headers, Inject, Param, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import type { z } from 'zod';
import { conformBody } from '../../../../../../problems/upstream-answer.js';
import {
  relayProblems,
  type AcceptedProblems,
} from '../../../../../../problems/upstream-problem.js';
import { RequiredBody } from '../../../../../../presentation/http/mappers/request-body.mapper.js';
import {
  IfMatchHeader,
  toRequestHeader,
} from '../../../../../../presentation/http/mappers/request-headers.mapper.js';
import { CredentialGuard } from '../../../../../auth/public/credential/credential-guard.js';
import { RateLimitGuard } from '../../../../../rate-limit/public/requests/rate-limit-guard.js';
import { DuplicateList } from '../../../../application/use-cases/commands/lists/duplicate-list/duplicate-list.use-case.js';

/** Client errors declared for this duplicate operation. */
const PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  403: ['access.role-insufficient'],
  404: ['list.not-found', 'organization.not-found'],
  409: ['idempotency.request-in-progress'],
  412: ['request.version-mismatch'],
  422: ['list.duplicate-limit-reached', 'idempotency.key-reused'],
};

/** Public list duplication route. */
@Controller('v1')
@UseGuards(CredentialGuard, RateLimitGuard)
export class DuplicateListController {
  // #region Properties
  /** The duplication use case. */
  private readonly duplicate: DuplicateList;
  // #endregion
  // #region Constructor
  /** Binds the use case. */
  public constructor(@Inject(DuplicateList) duplicate: DuplicateList) {
    this.duplicate = duplicate;
  }
  // #endregion
  // #region Methods
  /** Duplicates the resource once with the caller's headers. */
  @Post('lists/:listId/duplicate')
  @CredentialGuard.requires({
    operationId: 'duplicateList',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
  })
  public async duplicateList(
    @Param(new ZodValidationPipe(DuplicateListParams)) params: z.output<typeof DuplicateListParams>,
    @RequiredBody(DuplicateListBody) body: z.output<typeof DuplicateListBody>,
    @IfMatchHeader() ifMatch: string | undefined,
    @Headers('idempotency-key') key: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof DuplicateListResponse>> {
    const idempotencyKey = toRequestHeader(
      'Idempotency-Key',
      DuplicateListHeader.shape['Idempotency-Key'],
      key,
    );
    const result = conformBody(
      'task-service',
      'duplicateList',
      DuplicateListResponse,
      await relayProblems(PROBLEMS, () =>
        this.duplicate.execute(params.listId, body, ifMatch, idempotencyKey),
      ),
    );
    response.setHeader('ETag', formatEtag(result.list.version));
    response.setHeader('Location', `/v1/lists/${result.list.id}`);
    return result;
  }
  // #endregion
}

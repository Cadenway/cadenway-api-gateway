import {
  ListSpaceMilestonesParams,
  ListSpaceMilestonesQueryParams,
  ListSpaceMilestonesResponse,
} from '@cadenway/contracts/validators/public/spaces';
import { ZodValidationPipe } from '@cadenway/nest-common';
import { Controller, Get, Inject, Param, Query, UseGuards } from '@nestjs/common';
import type { z } from 'zod';
import { conformBody } from '../../../../../../problems/upstream-answer.js';
import {
  relayProblems,
  type AcceptedProblems,
} from '../../../../../../problems/upstream-problem.js';
import { CredentialGuard } from '../../../../../auth/public/credential/credential-guard.js';
import { RateLimitGuard } from '../../../../../rate-limit/public/requests/rate-limit-guard.js';
import { ListSpaceMilestones } from '../../../../application/use-cases/queries/spaces/list-space-milestones/list-space-milestones.use-case.js';

/** Contract errors of the milestones page. */
const PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  404: ['space.not-found', 'organization.not-found'],
};

/** Public space milestones query. */
@Controller('v1')
@UseGuards(CredentialGuard, RateLimitGuard)
export class ListSpaceMilestonesController {
  // #region Properties
  /** The milestones query. */
  private readonly listing: ListSpaceMilestones;
  // #endregion
  // #region Constructor
  /** Binds the query. */
  public constructor(@Inject(ListSpaceMilestones) listing: ListSpaceMilestones) {
    this.listing = listing;
  }
  // #endregion
  // #region Methods
  /** Returns a page of visible milestones. */
  @Get('spaces/:spaceId/milestones')
  @CredentialGuard.requires({
    operationId: 'listSpaceMilestones',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:read'] }],
    organization: true,
  })
  public async listSpaceMilestones(
    @Param(new ZodValidationPipe(ListSpaceMilestonesParams))
    params: z.output<typeof ListSpaceMilestonesParams>,
    @Query(new ZodValidationPipe(ListSpaceMilestonesQueryParams))
    query: z.output<typeof ListSpaceMilestonesQueryParams>,
  ): Promise<z.output<typeof ListSpaceMilestonesResponse>> {
    return conformBody(
      'task-service',
      'listSpaceMilestones',
      ListSpaceMilestonesResponse,
      await relayProblems(PROBLEMS, () => this.listing.execute(params.spaceId, query)),
    );
  }
  // #endregion
}

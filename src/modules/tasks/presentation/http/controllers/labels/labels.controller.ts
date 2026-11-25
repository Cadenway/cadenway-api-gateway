import {
  ListLabelsQueryParams,
  ListLabelsResponse,
} from '@cadenway/contracts/validators/public/tasks';
import { ZodValidationPipe } from '@cadenway/nest-common';
import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import type { z } from 'zod';

import { conformBody } from '../../../../../../problems/upstream-answer.js';
import {
  relayProblems,
  type AcceptedProblems,
} from '../../../../../../problems/upstream-problem.js';
import { CredentialGuard } from '../../../../../auth/public/credential/credential-guard.js';
import { RateLimitGuard } from '../../../../../rate-limit/public/requests/rate-limit-guard.js';
import { ListLabels } from '../../../../application/use-cases/queries/labels/list-labels/list-labels.use-case.js';

/**
 * Constant TASK_SERVICE
 *
 * @description
 * The service the routes of this controller relay, as `details.service` of the problem of an
 * answer the public contract cannot carry.
 *
 * @type {string}
 */
const TASK_SERVICE: string = 'task-service';

/**
 * Constant LIST_LABELS_PROBLEMS
 *
 * @description
 * Client errors of task-service that `GET /v1/labels` answers as they
 * are: the codes its public operation declares. Any other is `503 upstream.failed`.
 *
 * @type {AcceptedProblems}
 */
const LIST_LABELS_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  404: ['organization.not-found'],
};

/**
 * Class LabelsController
 *
 * @description
 * The labels route of `openapi/public/tasks.yaml`: the labels of the current organization.
 *
 * Every route accepts the session cookie or a personal API token with `tasks:read` (reads) or
 * `tasks:write` (writes, spaces and lists included), on the current organization:
 * `CredentialGuard` answers `403 auth.scope-missing`, `403 organization.not-selected` and
 * `403 organization.mfa-required` before any call, and `RateLimitGuard` counts the credential.
 * task-service decides everything; the gateway relays the client errors each public operation
 * declares, with their French titles, and maps every answer to the public contract through its
 * public validator.
 */
@Controller('v1')
@UseGuards(CredentialGuard, RateLimitGuard)
export class LabelsController {
  // #region Properties
  /**
   * Property labelListing
   *
   * @description
   * Use case `ListLabels`.
   *
   * @type {ListLabels}
   * @readonly
   */
  private readonly labelListing: ListLabels;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Receives the use cases of the routes.
   *
   * @param {ListLabels} labelListing - Use case `ListLabels`.
   * @constructor
   */
  public constructor(@Inject(ListLabels) labelListing: ListLabels) {
    this.labelListing = labelListing;
  }
  // #endregion

  // #region Methods
  /**
   * Method listLabels
   *
   * @description
   * `GET /v1/labels`: one page of the labels of the organization, searched.
   *
   * @param {z.output<typeof ListLabelsQueryParams>} query - The query, validated.
   * @returns {Promise<z.output<typeof ListLabelsResponse>>} The answer, mapped to the public contract.
   */
  @Get('labels')
  @CredentialGuard.requires({
    operationId: 'listLabels',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:read'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async listLabels(
    @Query(new ZodValidationPipe(ListLabelsQueryParams))
    query: z.output<typeof ListLabelsQueryParams>,
  ): Promise<z.output<typeof ListLabelsResponse>> {
    return conformBody(
      TASK_SERVICE,
      'listLabels',
      ListLabelsResponse,
      await relayProblems(LIST_LABELS_PROBLEMS, () => this.labelListing.execute(query)),
    );
  }
  // #endregion
}

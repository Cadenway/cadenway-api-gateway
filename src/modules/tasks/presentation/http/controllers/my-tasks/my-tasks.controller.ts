import {
  GetHomeQueryParams,
  GetHomeResponse,
  ListMyTasksQueryParams,
  ListMyTasksResponse,
} from '@cadenway/contracts/validators/public/tasks';
import { ZodValidationPipe } from '@cadenway/nest-common';
import { Controller, Get, Inject, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { z } from 'zod';

import { conformBody } from '../../../../../../problems/upstream-answer.js';
import {
  relayProblems,
  type AcceptedProblems,
} from '../../../../../../problems/upstream-problem.js';
import {
  verifiedCredentialOf,
  type RequestCredential,
} from '../../../../../../presentation/http/session/request-session.js';
import { CredentialGuard } from '../../../../../auth/public/credential/credential-guard.js';
import { RateLimitGuard } from '../../../../../rate-limit/public/requests/rate-limit-guard.js';
import { ListMyTasks } from '../../../../application/use-cases/queries/my-tasks/list-my-tasks/list-my-tasks.use-case.js';
import { GetHome } from '../../../../application/use-cases/queries/my-tasks/get-home/get-home.use-case.js';

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
 * Constant LIST_MY_TASKS_PROBLEMS
 *
 * @description
 * Client errors of task-service that `GET /v1/me/tasks` answers as they
 * are: the codes its public operation declares. Any other is `503 upstream.failed`.
 *
 * @type {AcceptedProblems}
 */
const LIST_MY_TASKS_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  404: ['organization.not-found'],
};

/**
 * Constant GET_HOME_PROBLEMS
 *
 * @description
 * Client errors of task-service that `GET /v1/me/home` answers as they
 * are: the codes its public operation declares. Any other is `503 upstream.failed`.
 *
 * @type {AcceptedProblems}
 */
const GET_HOME_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  404: ['organization.not-found'],
};

/**
 * Function actorOf
 *
 * @description
 * The user the verified credential of the request acts for: the introspection of the session or
 * of the personal API token returned it. The routes never read a user from the request.
 *
 * @param {Request} request - The request, verified by `CredentialGuard`.
 * @returns {string} Id of the user (a UUID).
 * @throws {Error} When the request carries no verified credential: a programming error, since
 * `CredentialGuard` runs first.
 */
function actorOf(request: Request): string {
  const credential: RequestCredential | undefined = verifiedCredentialOf(request);
  if (credential === undefined) {
    throw new Error('The route runs without a verified credential.');
  }
  return credential.userId;
}

/**
 * Class MyTasksController
 *
 * @description
 * The routes of `openapi/public/tasks.yaml` about the caller: "Mes tâches" and the task part of "Accueil", for the user of the verified credential, never one the request names.
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
export class MyTasksController {
  // #region Properties
  /**
   * Property myTaskListing
   *
   * @description
   * Use case `ListMyTasks`.
   *
   * @type {ListMyTasks}
   * @readonly
   */
  private readonly myTaskListing: ListMyTasks;

  /**
   * Property homeReading
   *
   * @description
   * Use case `GetHome`.
   *
   * @type {GetHome}
   * @readonly
   */
  private readonly homeReading: GetHome;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Receives the use cases of the routes.
   *
   * @param {ListMyTasks} myTaskListing - Use case `ListMyTasks`.
   * @param {GetHome} homeReading - Use case `GetHome`.
   * @constructor
   */
  public constructor(
    @Inject(ListMyTasks) myTaskListing: ListMyTasks,
    @Inject(GetHome) homeReading: GetHome,
  ) {
    this.myTaskListing = myTaskListing;
    this.homeReading = homeReading;
  }
  // #endregion

  // #region Methods
  /**
   * Method listMyTasks
   *
   * @description
   * `GET /v1/me/tasks`: one page of the tasks assigned to the caller ("Mes tâches").
   *
   * @param {z.output<typeof ListMyTasksQueryParams>} query - The query, validated.
   * @param {Request} request - Request, for its verified credential.
   * @returns {Promise<z.output<typeof ListMyTasksResponse>>} The answer, mapped to the public contract.
   */
  @Get('me/tasks')
  @CredentialGuard.requires({
    operationId: 'listMyTasks',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:read'] }],
    organization: true,
  })
  public async listMyTasks(
    @Query(new ZodValidationPipe(ListMyTasksQueryParams))
    query: z.output<typeof ListMyTasksQueryParams>,
    @Req() request: Request,
  ): Promise<z.output<typeof ListMyTasksResponse>> {
    const userId: string = actorOf(request);
    return conformBody(
      TASK_SERVICE,
      'listMyTasks',
      ListMyTasksResponse,
      await relayProblems(LIST_MY_TASKS_PROBLEMS, () => this.myTaskListing.execute(userId, query)),
    );
  }

  /**
   * Method getHome
   *
   * @description
   * `GET /v1/me/home`: the task part of "Accueil" for the caller, on the `today` of the caller, which is relayed.
   *
   * @param {z.output<typeof GetHomeQueryParams>} query - The query, validated.
   * @param {Request} request - Request, for its verified credential.
   * @returns {Promise<z.output<typeof GetHomeResponse>>} The answer, mapped to the public contract.
   */
  @Get('me/home')
  @CredentialGuard.requires({
    operationId: 'getHome',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:read'] }],
    organization: true,
  })
  public async getHome(
    @Query(new ZodValidationPipe(GetHomeQueryParams)) query: z.output<typeof GetHomeQueryParams>,
    @Req() request: Request,
  ): Promise<z.output<typeof GetHomeResponse>> {
    const userId: string = actorOf(request);
    return conformBody(
      TASK_SERVICE,
      'getHome',
      GetHomeResponse,
      await relayProblems(GET_HOME_PROBLEMS, () => this.homeReading.execute(userId, query)),
    );
  }
  // #endregion
}

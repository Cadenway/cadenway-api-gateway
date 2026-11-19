import {
  EmptyTrashBody,
  EmptyTrashResponse,
  ListTrashQueryParams,
  ListTrashResponse,
  PurgeTrashEntryParams,
  RestoreTrashEntryBody,
  RestoreTrashEntryParams,
  RestoreTrashEntryResponse,
  TrashTaskBody,
  TrashTaskParams,
  TrashTaskResponse,
} from '@cadenway/contracts/validators/public/trash';
import { ZodValidationPipe } from '@cadenway/nest-common';
import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { z } from 'zod';

import { conformBody } from '../../../../../../problems/upstream-answer.js';
import {
  relayProblems,
  type AcceptedProblems,
} from '../../../../../../problems/upstream-problem.js';
import { CredentialGuard } from '../../../../../auth/public/credential/credential-guard.js';
import { RateLimitGuard } from '../../../../../rate-limit/public/requests/rate-limit-guard.js';
import { EmptyTrash } from '../../../../application/use-cases/commands/trash/empty-trash/empty-trash.use-case.js';
import { PurgeTrashEntry } from '../../../../application/use-cases/commands/trash/purge-trash-entry/purge-trash-entry.use-case.js';
import { RestoreTrashEntry } from '../../../../application/use-cases/commands/trash/restore-trash-entry/restore-trash-entry.use-case.js';
import { TrashTask } from '../../../../application/use-cases/commands/trash/trash-task/trash-task.use-case.js';
import { ListTrash } from '../../../../application/use-cases/queries/trash/list-trash/list-trash.use-case.js';

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
 * Constant TRASH_TASK_PROBLEMS
 *
 * @description
 * Client errors of task-service that `POST /v1/tasks/{taskKey}/trash` answers as they
 * are: the codes its public operation declares. Any other is `503 upstream.failed`. The
 * `details` of `404 task.trashed` (the entry) and of `409 task.archived` (`key`) are relayed.
 *
 * @type {AcceptedProblems}
 */
const TRASH_TASK_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  403: ['access.role-insufficient'],
  404: ['task.not-found', 'task.trashed', 'organization.not-found'],
  409: ['task.archived'],
  412: ['request.version-mismatch'],
};

/**
 * Constant LIST_TRASH_PROBLEMS
 *
 * @description
 * Client errors of task-service that `GET /v1/trash/entries` answers as they
 * are: the codes its public operation declares. Any other is `503 upstream.failed`.
 *
 * @type {AcceptedProblems}
 */
const LIST_TRASH_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  404: ['organization.not-found'],
};

/**
 * Constant RESTORE_TRASH_ENTRY_PROBLEMS
 *
 * @description
 * Client errors of task-service that `POST /v1/trash/entries/{entryId}/restore` answers as they
 * are: the codes both its public and its internal operation declare. The internal operation
 * declares no `403 access.role-insufficient` (an entry the caller may not restore is not found),
 * so that public code is never relayed. Any other is `503 upstream.failed`.
 *
 * @type {AcceptedProblems}
 */
const RESTORE_TRASH_ENTRY_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  404: ['trash-entry.not-found', 'organization.not-found'],
};

/**
 * Constant PURGE_TRASH_ENTRY_PROBLEMS
 *
 * @description
 * Client errors of task-service that `DELETE /v1/trash/entries/{entryId}` answers as they
 * are: the codes both its public and its internal operation declare (not the public
 * `403 access.role-insufficient`, which the internal operation does not declare). Any other is
 * `503 upstream.failed`.
 *
 * @type {AcceptedProblems}
 */
const PURGE_TRASH_ENTRY_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  404: ['trash-entry.not-found', 'organization.not-found'],
};

/**
 * Constant EMPTY_TRASH_PROBLEMS
 *
 * @description
 * Client errors of task-service that `POST /v1/trash/empty` answers as they
 * are: the codes both its public and its internal operation declare (not the public
 * `403 access.role-insufficient`, which the internal operation does not declare). Any other is
 * `503 upstream.failed`.
 *
 * @type {AcceptedProblems}
 */
const EMPTY_TRASH_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  404: ['organization.not-found'],
};

/**
 * Constant TRASH_TASK_BODY
 *
 * @description
 * Validator of the body of `POST /v1/tasks/{taskKey}/trash`: an empty object, with no other
 * member (`additionalProperties: false` of `EmptyRequest`, which the generated validator does not
 * enforce).
 *
 * @type {z.ZodType<Record<string, never>>}
 */
const TRASH_TASK_BODY: z.ZodType<Record<string, never>> = TrashTaskBody.strict();

/**
 * Constant RESTORE_TRASH_ENTRY_BODY
 *
 * @description
 * Validator of the body of `POST /v1/trash/entries/{entryId}/restore`: the empty object of
 * `EmptyRequest`, with no other member.
 *
 * @type {z.ZodType<Record<string, never>>}
 */
const RESTORE_TRASH_ENTRY_BODY: z.ZodType<Record<string, never>> = RestoreTrashEntryBody.strict();

/**
 * Constant EMPTY_TRASH_BODY
 *
 * @description
 * Validator of the body of `POST /v1/trash/empty`: the empty object of `EmptyRequest`, with no
 * other member.
 *
 * @type {z.ZodType<Record<string, never>>}
 */
const EMPTY_TRASH_BODY: z.ZodType<Record<string, never>> = EmptyTrashBody.strict();

/**
 * Class TrashController
 *
 * @description
 * The routes of `openapi/public/trash.yaml`: delete a task with its subtasks, list the trash,
 * restore or erase an entry, empty the trash.
 *
 * Every route accepts the session cookie or a personal API token with `tasks:read` (the listing)
 * or `tasks:write` (the others), on the current organization: `CredentialGuard` answers
 * `403 auth.scope-missing`, `403 organization.not-selected` and `403 organization.mfa-required`
 * before any call, and `RateLimitGuard` counts the credential. task-service decides everything;
 * the gateway relays the client errors each public operation declares, with their French titles,
 * and maps every answer to the public contract through its public validator. No success answer
 * of the contract declares an `ETag` or a `Location`, and none of their bodies has a top-level
 * `version`, so none is set.
 */
@Controller('v1')
@UseGuards(CredentialGuard, RateLimitGuard)
export class TrashController {
  // #region Properties
  /**
   * Property taskTrashing
   *
   * @description
   * Use case `TrashTask`.
   *
   * @type {TrashTask}
   * @readonly
   */
  private readonly taskTrashing: TrashTask;

  /**
   * Property trashListing
   *
   * @description
   * Use case `ListTrash`.
   *
   * @type {ListTrash}
   * @readonly
   */
  private readonly trashListing: ListTrash;

  /**
   * Property entryRestoration
   *
   * @description
   * Use case `RestoreTrashEntry`.
   *
   * @type {RestoreTrashEntry}
   * @readonly
   */
  private readonly entryRestoration: RestoreTrashEntry;

  /**
   * Property entryPurge
   *
   * @description
   * Use case `PurgeTrashEntry`.
   *
   * @type {PurgeTrashEntry}
   * @readonly
   */
  private readonly entryPurge: PurgeTrashEntry;

  /**
   * Property trashEmptying
   *
   * @description
   * Use case `EmptyTrash`.
   *
   * @type {EmptyTrash}
   * @readonly
   */
  private readonly trashEmptying: EmptyTrash;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Receives the use cases of the routes.
   *
   * @param {TrashTask} taskTrashing - Use case `TrashTask`.
   * @param {ListTrash} trashListing - Use case `ListTrash`.
   * @param {RestoreTrashEntry} entryRestoration - Use case `RestoreTrashEntry`.
   * @param {PurgeTrashEntry} entryPurge - Use case `PurgeTrashEntry`.
   * @param {EmptyTrash} trashEmptying - Use case `EmptyTrash`.
   * @constructor
   */
  public constructor(
    @Inject(TrashTask) taskTrashing: TrashTask,
    @Inject(ListTrash) trashListing: ListTrash,
    @Inject(RestoreTrashEntry) entryRestoration: RestoreTrashEntry,
    @Inject(PurgeTrashEntry) entryPurge: PurgeTrashEntry,
    @Inject(EmptyTrash) trashEmptying: EmptyTrash,
  ) {
    this.taskTrashing = taskTrashing;
    this.trashListing = trashListing;
    this.entryRestoration = entryRestoration;
    this.entryPurge = entryPurge;
    this.trashEmptying = trashEmptying;
  }
  // #endregion

  // #region Methods
  /**
   * Method trashTask
   *
   * @description
   * `POST /v1/tasks/{taskKey}/trash`: moves a task and its subtasks to the trash, with the optional `If-Match` relayed unchanged. `200` with the trash entry.
   *
   * @param {z.output<typeof TrashTaskParams>} params - The path parameters.
   * @param {z.output<typeof TRASH_TASK_BODY>} body - The empty body, validated.
   * @param {string | undefined} ifMatch - `If-Match` of the request, relayed unchanged.
   * @returns {Promise<z.output<typeof TrashTaskResponse>>} The answer, mapped to the public contract.
   */
  @Post('tasks/:taskKey/trash')
  @HttpCode(200)
  @CredentialGuard.requires({
    operationId: 'trashTask',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
  })
  public async trashTask(
    @Param(new ZodValidationPipe(TrashTaskParams)) params: z.output<typeof TrashTaskParams>,
    @Body(new ZodValidationPipe(TRASH_TASK_BODY)) body: z.output<typeof TRASH_TASK_BODY>,
    @Headers('if-match') ifMatch: string | undefined,
  ): Promise<z.output<typeof TrashTaskResponse>> {
    return conformBody(
      TASK_SERVICE,
      'trashTask',
      TrashTaskResponse,
      await relayProblems(TRASH_TASK_PROBLEMS, () =>
        this.taskTrashing.execute(params.taskKey, body, ifMatch),
      ),
    );
  }

  /**
   * Method listTrash
   *
   * @description
   * `GET /v1/trash/entries`: one page of the entries the caller may restore, with their `total`.
   *
   * @param {z.output<typeof ListTrashQueryParams>} query - The query, validated.
   * @returns {Promise<z.output<typeof ListTrashResponse>>} The answer, mapped to the public contract.
   */
  @Get('trash/entries')
  @CredentialGuard.requires({
    operationId: 'listTrash',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:read'] }],
    organization: true,
  })
  public async listTrash(
    @Query(new ZodValidationPipe(ListTrashQueryParams))
    query: z.output<typeof ListTrashQueryParams>,
  ): Promise<z.output<typeof ListTrashResponse>> {
    return conformBody(
      TASK_SERVICE,
      'listTrash',
      ListTrashResponse,
      await relayProblems(LIST_TRASH_PROBLEMS, () => this.trashListing.execute(query)),
    );
  }

  /**
   * Method restoreTrashEntry
   *
   * @description
   * `POST /v1/trash/entries/{entryId}/restore`: brings an entry back to its list. `200` with what came back.
   *
   * @param {z.output<typeof RestoreTrashEntryParams>} params - The path parameters.
   * @param {z.output<typeof RESTORE_TRASH_ENTRY_BODY>} body - The empty body, validated.
   * @returns {Promise<z.output<typeof RestoreTrashEntryResponse>>} The answer, mapped to the public contract.
   */
  @Post('trash/entries/:entryId/restore')
  @HttpCode(200)
  @CredentialGuard.requires({
    operationId: 'restoreTrashEntry',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
  })
  public async restoreTrashEntry(
    @Param(new ZodValidationPipe(RestoreTrashEntryParams))
    params: z.output<typeof RestoreTrashEntryParams>,
    @Body(new ZodValidationPipe(RESTORE_TRASH_ENTRY_BODY))
    body: z.output<typeof RESTORE_TRASH_ENTRY_BODY>,
  ): Promise<z.output<typeof RestoreTrashEntryResponse>> {
    return conformBody(
      TASK_SERVICE,
      'restoreTrashEntry',
      RestoreTrashEntryResponse,
      await relayProblems(RESTORE_TRASH_ENTRY_PROBLEMS, () =>
        this.entryRestoration.execute(params.entryId, body),
      ),
    );
  }

  /**
   * Method purgeTrashEntry
   *
   * @description
   * `DELETE /v1/trash/entries/{entryId}`: erases an entry for good. `204` without a body.
   *
   * @param {z.output<typeof PurgeTrashEntryParams>} params - The path parameters.
   * @returns {Promise<void>} Resolves once the entry is erased.
   */
  @Delete('trash/entries/:entryId')
  @HttpCode(204)
  @CredentialGuard.requires({
    operationId: 'purgeTrashEntry',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
  })
  public async purgeTrashEntry(
    @Param(new ZodValidationPipe(PurgeTrashEntryParams))
    params: z.output<typeof PurgeTrashEntryParams>,
  ): Promise<void> {
    await relayProblems(PURGE_TRASH_ENTRY_PROBLEMS, () => this.entryPurge.execute(params.entryId));
  }

  /**
   * Method emptyTrash
   *
   * @description
   * `POST /v1/trash/empty`: takes every entry the caller may restore out of the trash. `202` with the count of the entries taken out.
   *
   * @param {z.output<typeof EMPTY_TRASH_BODY>} body - The empty body, validated.
   * @returns {Promise<z.output<typeof EmptyTrashResponse>>} The answer, mapped to the public contract.
   */
  @Post('trash/empty')
  @HttpCode(202)
  @CredentialGuard.requires({
    operationId: 'emptyTrash',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
  })
  public async emptyTrash(
    @Body(new ZodValidationPipe(EMPTY_TRASH_BODY)) body: z.output<typeof EMPTY_TRASH_BODY>,
  ): Promise<z.output<typeof EmptyTrashResponse>> {
    return conformBody(
      TASK_SERVICE,
      'emptyTrash',
      EmptyTrashResponse,
      await relayProblems(EMPTY_TRASH_PROBLEMS, () => this.trashEmptying.execute(body)),
    );
  }
  // #endregion
}

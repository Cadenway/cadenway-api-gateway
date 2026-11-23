import {
  CheckTaskAttachmentAccessInternalQueryParams,
  ResolveNotificationSubjectsInternalBody,
  ResolveNotificationSubjectsInternalResponse,
  AddChecklistItemInternalBody,
  AddChecklistItemInternalResponse,
  AddTaskLabelInternalBody,
  AddTaskLabelInternalResponse,
  ApproveAccessRequestInternalBody,
  ApproveAccessRequestInternalResponse,
  ArchiveListInternalBody,
  ArchiveListInternalResponse,
  ArchiveTaskInternalBody,
  ArchiveTaskInternalResponse,
  AssignTaskInternalResponse,
  CountTaskGroupsInternalQueryParams,
  CountTaskGroupsInternalResponse,
  CreateAccessRequestInternalBody,
  CreateListInternalBody,
  CreateListInternalResponse,
  CreateSpaceInternalBody,
  CreateSpaceInternalResponse,
  CreateSubtaskInternalBody,
  CreateSubtaskInternalResponse,
  CreateTaskCommentInternalBody,
  CreateTaskCommentInternalResponse,
  GetTaskCommentInternalResponse,
  UpdateTaskCommentInternalBody,
  UpdateTaskCommentInternalResponse,
  ListTaskParticipantsInternalQueryParams,
  ListTaskParticipantsInternalResponse,
  CreateTaskInternalBody,
  CreateTaskInternalResponse,
  DuplicateListInternalBody,
  DuplicateListInternalResponse,
  DuplicateTaskInternalBody,
  DuplicateTaskInternalResponse,
  ExecuteBulkTaskActionInternalBody,
  ExecuteBulkTaskActionInternalResponse,
  EmptyTrashInternalBody,
  EmptyTrashInternalResponse,
  GetHomeInternalQueryParams,
  GetHomeInternalResponse,
  GetListCountsInternalQueryParams,
  GetListCountsInternalResponse,
  GetListInternalResponse,
  GetSpaceInternalResponse,
  GetSpaceOverviewInternalQueryParams,
  GetSpaceOverviewInternalResponse,
  GetTaskDetailInternalResponse,
  GetTaskInternalResponse,
  GetTaskVisibilityInternalBody,
  GetTaskVisibilityInternalResponse,
  ListAccessRequestsInternalQueryParams,
  ListAccessRequestsInternalResponse,
  ListArchivedListsInternalQueryParams,
  ListArchivedListsInternalResponse,
  ListArchivedTasksInternalQueryParams,
  ListArchivedTasksInternalResponse,
  ListLabelsInternalQueryParams,
  ListLabelsInternalResponse,
  ListListActivityInternalQueryParams,
  ListListActivityInternalResponse,
  ListListGrantsInternalQueryParams,
  ListListGrantsInternalResponse,
  ListListsInternalQueryParams,
  ListListsInternalResponse,
  ListMyTasksInternalQueryParams,
  ListMyTasksInternalResponse,
  ListFavoritesInternalQueryParams,
  ListFavoritesInternalResponse,
  CreateFavoriteInternalBody,
  CreateFavoriteInternalResponse,
  GetFavoriteInternalResponse,
  ListSavedViewsInternalQueryParams,
  ListSavedViewsInternalResponse,
  CreateSavedViewInternalBody,
  CreateSavedViewInternalResponse,
  GetSavedViewInternalResponse,
  UpdateSavedViewInternalBody,
  UpdateSavedViewInternalResponse,
  DuplicateSavedViewInternalBody,
  DuplicateSavedViewInternalResponse,
  ListTaskTemplatesInternalQueryParams,
  ListTaskTemplatesInternalResponse,
  CreateTaskTemplateInternalBody,
  CreateTaskTemplateInternalResponse,
  GetTaskTemplateInternalResponse,
  ListSpaceMilestonesInternalQueryParams,
  ListSpaceMilestonesInternalResponse,
  ListSpaceGrantsInternalQueryParams,
  ListSpaceGrantsInternalResponse,
  ListSpacesInternalQueryParams,
  ListSpacesInternalResponse,
  ListSubtasksInternalQueryParams,
  ListSubtasksInternalResponse,
  ListTaskCommentsInternalQueryParams,
  ListTaskCommentsInternalResponse,
  ListTaskDependenciesInternalQueryParams,
  ListTaskDependenciesInternalResponse,
  CreateTaskDependencyInternalBody,
  CreateTaskDependencyInternalResponse,
  GetTaskDependencyInternalResponse,
  ListDependencyCandidatesInternalQueryParams,
  ListDependencyCandidatesInternalResponse,
  ListTaskWatchersInternalQueryParams,
  ListTaskWatchersInternalResponse,
  FollowTaskWatcherInternalBody,
  FollowTaskWatcherInternalResponse,
  ListTaskActivityInternalQueryParams,
  ListTaskActivityInternalResponse,
  ListTaskTimeEntriesInternalQueryParams,
  ListTaskTimeEntriesInternalResponse,
  CreateTaskTimeEntryInternalBody,
  CreateTaskTimeEntryInternalResponse,
  GetTaskTimeEntryInternalResponse,
  GetTaskTimeSummaryInternalResponse,
  GetTaskStatusDurationsInternalResponse,
  GetTaskApprovalInternalResponse,
  RequestTaskApprovalInternalBody,
  RequestTaskApprovalInternalResponse,
  VoteOnTaskApprovalInternalBody,
  VoteOnTaskApprovalInternalResponse,
  GetOnboardingInternalResponse,
  UpdateOnboardingInternalBody,
  UpdateOnboardingInternalResponse,
  UpdateOnboardingChecklistInternalBody,
  UpdateOnboardingChecklistInternalResponse,
  FinishOnboardingInternalBody,
  FinishOnboardingInternalResponse,
  ListSpaceCustomFieldsInternalQueryParams,
  ListSpaceCustomFieldsInternalResponse,
  CreateSpaceCustomFieldInternalBody,
  CreateSpaceCustomFieldInternalResponse,
  GetSpaceCustomFieldInternalResponse,
  UpdateSpaceCustomFieldInternalBody,
  UpdateSpaceCustomFieldInternalResponse,
  ListListCustomFieldsInternalQueryParams,
  ListListCustomFieldsInternalResponse,
  ListTasksInternalQueryParams,
  ListTasksInternalResponse,
  ListTrashInternalQueryParams,
  ListTrashInternalResponse,
  RefuseAccessRequestInternalBody,
  RefuseAccessRequestInternalResponse,
  RemoveTaskLabelInternalBody,
  RemoveTaskLabelInternalResponse,
  RestoreTrashEntryInternalBody,
  RestoreTrashEntryInternalQueryParams,
  RestoreTrashEntryInternalResponse,
  SetListGrantInternalBody,
  SetListGrantInternalResponse,
  SetSpaceGrantInternalBody,
  SetSpaceGrantInternalResponse,
  TrashTaskInternalBody,
  TrashTaskInternalResponse,
  UnarchiveListInternalBody,
  UnarchiveListInternalResponse,
  UnarchiveTaskInternalBody,
  UnarchiveTaskInternalResponse,
  UpdateChecklistItemInternalBody,
  UpdateChecklistItemInternalResponse,
  UpdateListInternalBody,
  UpdateListInternalResponse,
  UpdateSpaceInternalBody,
  UpdateSpaceInternalResponse,
  UpdateTaskInternalBody,
  UpdateTaskInternalResponse,
} from '@cadenway/contracts/validators/internal/task-service';
import type {
  InternalHttpClient,
  InternalRequestInit,
  InternalTokenClaims,
} from '@cadenway/nest-common';
import { trace } from '@opentelemetry/api';
import {
  ListGoalsInternalQueryParams,
  ListGoalsInternalResponse,
  CreateGoalInternalQueryParams,
  CreateGoalInternalBody,
  CreateGoalInternalResponse,
  GetGoalInternalQueryParams,
  GetGoalInternalResponse,
  UpdateGoalInternalQueryParams,
  UpdateGoalInternalBody,
  UpdateGoalInternalResponse,
  CreateGoalResultInternalBody,
  CreateGoalResultInternalResponse,
  GetGoalResultInternalResponse,
  UpdateGoalResultInternalBody,
  UpdateGoalResultInternalResponse,
  GetSprintReportInternalQueryParams,
  GetSprintReportInternalResponse,
  GetListWorkloadInternalQueryParams,
  GetListWorkloadInternalResponse,
  GetListTimesheetInternalQueryParams,
  GetListTimesheetInternalResponse,
  ExportListTasksInternalParams,
  ExportListTasksInternalQueryParams,
  GetTeamDashboardInternalQueryParams,
  GetTeamDashboardInternalResponse,
  GetIntakeFormConfigurationInternalResponse,
  UpdateIntakeFormConfigurationInternalBody,
  UpdateIntakeFormConfigurationInternalResponse,
  PublishIntakeFormInternalResponse,
  GetTaskIntakeContactInternalResponse,
  GetPublicIntakeFormInternalResponse,
  AllocateIntakeAttachmentInternalBody,
  AllocateIntakeAttachmentInternalHeader,
  AllocateIntakeAttachmentInternalParams,
  AllocateIntakeAttachmentInternalResponse,
  ResolveIntakeAttachmentInternalHeader,
  ResolveIntakeAttachmentInternalParams,
  ResolveIntakeAttachmentInternalResponse,
  ReleaseIntakeAttachmentInternalHeader,
  ReleaseIntakeAttachmentInternalParams,
  SubmitPublicIntakeFormInternalBody,
  SubmitPublicIntakeFormInternalHeader,
  SubmitPublicIntakeFormInternalResponse,
} from '@cadenway/contracts/validators/internal/task-service';
import type { z } from 'zod';

import {
  readTaskCsvExport,
  TASK_CSV_NDJSON,
  type TaskCsvExportFrame,
} from '../infrastructure/http/task-csv-export-stream.js';
import {
  answered,
  expectBody,
  expectStatus,
  outsideContract,
  type GeneratedResponse,
} from '../problems/upstream-answer.js';
import { getTaskServiceInternalRoutes } from './generated/task-service.js';

/**
 * Constant TASK_SERVICE
 *
 * @description
 * Name of task-service: the `aud` of the internal tokens of its calls, the name of its circuit
 * breaker and the `details.service` of the problems its calls raise.
 *
 * @type {string}
 */
export const TASK_SERVICE: string = 'task-service';

/**
 * Type TaskServiceRoutes
 *
 * @description
 * The functions orval generated from `openapi/internal/task-service.yaml`.
 *
 * @type {ReturnType<typeof getTaskServiceInternalRoutes>}
 */
type TaskServiceRoutes = ReturnType<typeof getTaskServiceInternalRoutes>;

/**
 * Interface GeneratedAnswer
 *
 * @description
 * What a generated function of task-service resolves with, its headers included: the `ETag` of
 * an unassignment or of a grant and the `Location` of a checklist item are read from them.
 */
interface GeneratedAnswer extends GeneratedResponse {
  // #region Properties
  /**
   * Property headers
   *
   * @description
   * Headers of the response.
   *
   * @type {Headers}
   * @readonly
   */
  readonly headers: Headers;
  // #endregion
}

/**
 * Interface VersionedGrant
 *
 * @description
 * A grant task-service gave or changed, with the version its `ETag` answers: the version of the
 * space for a grant of a space, of the list for a grant of a list. The `Grant` of the contract
 * carries no version of its own.
 */
export interface VersionedGrant {
  // #region Properties
  /**
   * Property grant
   *
   * @description
   * The grant, as the internal contract types it (`Grant`, the same for a space and a list).
   *
   * @type {z.output<typeof SetSpaceGrantInternalResponse>}
   * @readonly
   */
  readonly grant: z.output<typeof SetSpaceGrantInternalResponse>;

  /**
   * Property version
   *
   * @description
   * Version of the space or of the list after the change, from the strong `ETag` of the answer.
   *
   * @type {number}
   * @readonly
   */
  readonly version: number;
  // #endregion
}

/**
 * Constant EMPTY_REQUEST
 *
 * @description
 * The empty object the assignment carries as its body (`EmptyRequest` of the contract).
 *
 * @type {Readonly<Record<string, never>>}
 */
const EMPTY_REQUEST: Readonly<Record<string, never>> = Object.freeze({});

/**
 * Constant ETAG
 *
 * @description
 * A strong entity tag as task-service sends it: the version of the space, the list or the task
 * between quotes.
 *
 * @type {RegExp}
 */
const ETAG: RegExp = /^"(\d{1,15})"$/u;

/**
 * Constant CHECKLIST_ITEM_LOCATION
 *
 * @description
 * The `Location` of a created checklist item, `/internal/v1/tasks/<key>/checklist-items/<id>`:
 * the key of the task, then the id of the item (a UUID, of either case).
 *
 * @type {RegExp}
 */
const CHECKLIST_ITEM_LOCATION: RegExp =
  /^\/internal\/v1\/tasks\/([A-Z]{2,5}-[1-9]\d{0,8})\/checklist-items\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/u;

/**
 * Function call
 *
 * @description
 * Awaits a generated call of task-service and checks its answer against the operation: the
 * success status, then the body against the zod validator of `@cadenway/contracts`, keeping the
 * members of the contract only.
 *
 * @param {string} operation - `operationId` of the call.
 * @param {number} status - Success status of the operation.
 * @param {TSchema} schema - Validator of the success body.
 * @param {Promise<GeneratedResponse>} pending - The generated call.
 * @returns {Promise<z.output<TSchema>>} The validated body.
 * @throws {ProblemException} The relayed client error, or `503 upstream.*`.
 */
async function call<TSchema extends z.ZodType>(
  operation: string,
  status: number,
  schema: TSchema,
  pending: Promise<GeneratedResponse>,
): Promise<z.output<TSchema>> {
  return expectBody(
    TASK_SERVICE,
    operation,
    await answered(TASK_SERVICE, operation, pending),
    status,
    schema,
  );
}

/**
 * Function acknowledged
 *
 * @description
 * Awaits a generated call of task-service whose success carries no body the gateway reads (a
 * `204`, or the `202` of an access request) and checks its success status only.
 *
 * @param {string} operation - `operationId` of the call.
 * @param {number} status - Success status of the operation.
 * @param {Promise<GeneratedResponse>} pending - The generated call.
 * @returns {Promise<void>} Once the call answered its success status.
 * @throws {ProblemException} The relayed client error, or `503 upstream.*`.
 */
async function acknowledged(
  operation: string,
  status: number,
  pending: Promise<GeneratedResponse>,
): Promise<void> {
  expectStatus(TASK_SERVICE, operation, await answered(TASK_SERVICE, operation, pending), status);
}

/**
 * Function versionOf
 *
 * @description
 * Reads the version a success of task-service answers in its strong `ETag`.
 *
 * @param {string} operation - `operationId` of the call.
 * @param {GeneratedAnswer} answer - The success.
 * @returns {number} The version of the space, the list or the task after the change.
 * @throws {ProblemException} 503 `upstream.failed` without a strong `ETag`.
 */
function versionOf(operation: string, answer: GeneratedAnswer): number {
  const version: string | undefined = ETAG.exec(answer.headers.get('ETag') ?? '')?.[1];
  if (version === undefined) {
    throw outsideContract(TASK_SERVICE, operation, 'no strong ETag');
  }
  return Number(version);
}

/** A validated response body and the version returned in its ETag. */
interface VersionedBody<TSchema extends z.ZodType> {
  // #region Properties
  /** The validated response body. */
  readonly body: z.output<TSchema>;

  /** The strong ETag version. */
  readonly version: number;
  // #endregion
}

/** A validated field definition and its ETag version. */
interface VersionedField<TSchema extends z.ZodType> {
  // #region Properties
  /** The validated field definition. */
  readonly field: z.output<TSchema>;

  /** The strong ETag version. */
  readonly version: number;
  // #endregion
}

/** Validates a versioned response and requires agreement between its body and ETag. */
async function versionedBody<TSchema extends z.ZodType>(
  operation: string,
  schema: TSchema,
  pending: Promise<GeneratedAnswer>,
  bodyVersion: (body: z.output<TSchema>) => number,
): Promise<VersionedBody<TSchema>> {
  const answer = await answered(TASK_SERVICE, operation, pending);
  const body = expectBody(TASK_SERVICE, operation, answer, 200, schema);
  const version = versionOf(operation, answer);
  if (version !== bodyVersion(body)) {
    throw outsideContract(
      TASK_SERVICE,
      operation,
      'an ETag that disagrees with the response version',
    );
  }
  return { body, version };
}

/**
 * Function toRequest
 *
 * @description
 * Checks what the gateway is about to send against the internal contract: the query or the body
 * the public validator accepted. Both contracts share their schemas, so a mismatch is a defect of
 * the gateway, never of the caller: it is thrown as an `Error` (`500`), naming the members only.
 *
 * @param {string} operation - `operationId` of the call.
 * @param {TSchema} schema - Validator of the internal query or body.
 * @param {unknown} value - What the route passes.
 * @returns {z.output<TSchema>} The value as the internal contract types it.
 * @throws {Error} When the value does not match the internal contract.
 */
function toRequest<TSchema extends z.ZodType>(
  operation: string,
  schema: TSchema,
  value: unknown,
): z.output<TSchema> {
  const parsed: z.ZodSafeParseResult<z.output<TSchema>> = schema.safeParse(value);
  if (!parsed.success) {
    const members: string = parsed.error.issues
      .map((issue: z.core.$ZodIssue) => issue.path.join('.') || '(body)')
      .join(', ');
    throw new Error(`The gateway built ${operation} outside the internal contract: ${members}.`);
  }
  return parsed.data;
}

/**
 * Function withHeaders
 *
 * @description
 * The request options that relay `If-Match` or `Idempotency-Key` of the public request
 * unchanged. A call with `If-Match` is never retried (`idempotent: false`): a repeat after a
 * change that succeeded would answer `412 request.version-mismatch`.
 *
 * @param {'If-Match' | 'Idempotency-Key'} name - The header.
 * @param {string | undefined} value - Its value in the public request, or none.
 * @returns {InternalRequestInit} The options of the generated call.
 */
function withHeaders(
  name: 'If-Match' | 'Idempotency-Key',
  value: string | undefined,
): InternalRequestInit {
  if (value === undefined) {
    return {};
  }
  return name === 'If-Match'
    ? { headers: { [name]: value }, idempotent: false }
    : { headers: { [name]: value } };
}

/**
 * Function sentOnce
 *
 * @description
 * The request options of a mutation of task-service that is never retried (`idempotent: false`),
 * whatever its method: every change but a creation with an `Idempotency-Key`. A `PUT` or a
 * `DELETE` repeated after a lost answer would undo what another actor changed in between: a grant
 * revoked, then given again by the repeat; an assignee removed, then assigned again.
 *
 * @param {InternalRequestInit} init - The options to send once, such as those of `withHeaders`.
 * @returns {InternalRequestInit} The same options, never retried.
 */
function sentOnce(init: InternalRequestInit = {}): InternalRequestInit {
  return { ...init, idempotent: false };
}

/** Signs anonymous intake calls without an organization and includes only their private headers. */
function intakeSystemClaims(draftKey?: string, key?: string): InternalRequestInit {
  const traceId = trace.getActiveSpan()?.spanContext().traceId;
  const claims: InternalTokenClaims = {
    actor: { type: 'system', id: null },
    organizationId: null,
    role: null,
    scopes: [],
    ...(traceId === undefined ? {} : { traceId }),
  };
  return {
    claims,
    headers: {
      ...(draftKey === undefined ? {} : { 'Intake-Draft-Key': draftKey }),
      ...(key === undefined ? {} : { 'Idempotency-Key': key }),
    },
  };
}

/** Rejects an applicant response that could be kept by a cache. */
function requireIntakeNoStore(operation: string, headers: Headers): void {
  if (headers.get('Cache-Control')?.toLowerCase() !== 'no-store') {
    throw outsideContract(TASK_SERVICE, operation, 'missing Cache-Control no-store');
  }
}

/**
 * Class TaskServiceClient
 *
 * @description
 * Outgoing adapter of task-service: the functions generated from
 * `openapi/internal/task-service.yaml`, called through one `InternalHttpClient` of
 * `@cadenway/nest-common`, behind the ports of the space, list, task, access, archive and trash
 * routes.
 *
 * - Every call carries an internal token signed by the gateway with `aud: task-service`, for the
 *   user and organization of the current organization context. task-service decides who sees
 *   what and answers what the actor does not see `404`.
 * - Every query and body is checked against the internal contract before it is sent, and every
 *   success after it is answered; a mismatching answer is `503 upstream.failed`.
 * - The internal HTTP client gives ordinary calls up to 2 seconds, one retry after a connection
 *   error or a `503` for an idempotent call, and the circuit breaker of task-service. The CSV
 *   export is sent once and only its streamed body uses the longer export budget. Retried are
 *   other `GET` requests, the read-only Task visibility batch and a creation with an `Idempotency-Key`, which
 *   task-service replays. Every other mutation is sent once (`sentOnce`), with or without
 *   `If-Match`: the `PATCH` of a space, a list, a task or a checklist item; the `DELETE` of a space
 *   or a list; the `PUT` and `DELETE` of an assignee and of a grant; the addition and removal of a
 *   label; an access request, its approval and its refusal; an archive and its restoration; a move
 *   to the trash, the erasure and the restoration of an entry and the emptying of the trash. A
 *   change retried after its answer was lost could undo what another actor changed in between,
 *   such as a grant revoked then given again, and a repeat of a change that succeeded under
 *   `If-Match` would answer `412 request.version-mismatch`.
 * - `If-Match` and `Idempotency-Key` are relayed unchanged; task-service checks the version and
 *   replays a creation.
 * - The access checks of a list and a task (`GET /internal/v1/lists/{listId}/access` and
 *   `GET /internal/v1/tasks/{taskKey}/access`) have no method here: task-service accepts them from
 *   the issuer `realtime-gateway` only and answers the gateway `403 auth.issuer-not-allowed`.
 */
export class TaskServiceClient {
  // #region Properties
  /**
   * Property routes
   *
   * @description
   * The generated functions, bound to the `fetch` of the internal HTTP client.
   *
   * @type {TaskServiceRoutes}
   * @readonly
   */
  private readonly routes: TaskServiceRoutes;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Binds the generated functions to the internal HTTP client of task-service, which resolves the
   * generated paths (`/internal/v1/...`) against `TASK_SERVICE_URL`.
   *
   * @param {InternalHttpClient} http - Internal HTTP client built for task-service.
   * @constructor
   */
  public constructor(private readonly http: InternalHttpClient) {
    this.routes = getTaskServiceInternalRoutes(
      async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
        if (typeof input !== 'string') {
          throw new Error('The generated task-service client passes a path.');
        }
        return http.fetch(input, init);
      },
    );
  }
  // #endregion

  // #region Methods
  /** Checks the current Task authorization before a Storage attachment operation. */
  public async checkTaskAttachmentAccess(taskKey: string, mode: 'read' | 'write'): Promise<void> {
    const operation = 'checkTaskAttachmentAccessInternal';
    const answer = await answered(
      TASK_SERVICE,
      operation,
      this.routes.checkTaskAttachmentAccessInternal(
        taskKey,
        toRequest(operation, CheckTaskAttachmentAccessInternalQueryParams, { mode }),
      ),
    );
    expectStatus(TASK_SERVICE, operation, answer, 204);
    if (answer.headers.get('Cache-Control')?.toLowerCase() !== 'no-store') {
      throw outsideContract(TASK_SERVICE, operation, 'missing Cache-Control no-store');
    }
  }

  /** Resolves current subject visibility in one Task snapshot. */
  public async resolveNotificationSubjects(
    input: z.input<typeof ResolveNotificationSubjectsInternalBody>,
    signal?: AbortSignal,
  ): Promise<z.output<typeof ResolveNotificationSubjectsInternalResponse>> {
    const operation = 'resolveNotificationSubjectsInternal';
    const request = ResolveNotificationSubjectsInternalBody.parse(input);
    const response = await answered(
      TASK_SERVICE,
      operation,
      this.routes.resolveNotificationSubjectsInternal(request, {
        idempotent: false,
        ...(signal === undefined ? {} : { signal }),
      } as InternalRequestInit),
    );
    if (response.headers.get('Cache-Control')?.toLowerCase() !== 'no-store') {
      throw outsideContract(TASK_SERVICE, operation, 'missing no-store');
    }
    const result = expectBody(
      TASK_SERVICE,
      operation,
      response,
      200,
      ResolveNotificationSubjectsInternalResponse,
    );
    if (result.results.length !== request.subjects.length) {
      throw outsideContract(TASK_SERVICE, operation, 'wrong number of subject decisions');
    }
    for (const [index, decision] of result.results.entries()) {
      const subject = request.subjects[index];
      if (subject === undefined) {
        throw outsideContract(TASK_SERVICE, operation, 'unmatched subject decision');
      }
      if (decision.visible && 'display' in subject && decision.display === undefined) {
        throw outsideContract(TASK_SERVICE, operation, 'missing task display');
      }
      if (decision.visible && decision.display !== undefined) {
        if (
          !('display' in subject) ||
          (subject.subject.kind === 'task-id' &&
            decision.display.taskId.toLowerCase() !== subject.subject.taskId.toLowerCase()) ||
          (subject.subject.kind === 'task-key' &&
            decision.display.taskKey !== subject.subject.taskKey) ||
          ('display' in subject &&
            'commentId' in subject.display !== 'commentExcerpt' in decision.display)
        ) {
          throw outsideContract(TASK_SERVICE, operation, 'unrequested or mismatched task display');
        }
      }
    }
    return result;
  }

  /** Lists visible quarterly goals. */
  public listGoals(query: unknown): Promise<z.output<typeof ListGoalsInternalResponse>> {
    const operation = 'listGoalsInternal';
    return call(
      operation,
      200,
      ListGoalsInternalResponse,
      this.routes.listGoalsInternal(toRequest(operation, ListGoalsInternalQueryParams, query)),
    );
  }

  /** Creates one goal and checks its public Location and ETag. */
  public async createGoal(
    body: unknown,
    query: unknown,
    key?: string,
  ): Promise<VersionedBody<typeof CreateGoalInternalResponse>> {
    const operation = 'createGoalInternal';
    const params = toRequest(operation, CreateGoalInternalQueryParams, query);
    const answer = await answered(
      TASK_SERVICE,
      operation,
      this.routes.createGoalInternal(
        toRequest(operation, CreateGoalInternalBody, body),
        params,
        sentOnce(withHeaders('Idempotency-Key', key)),
      ),
    );
    const goal = expectBody(TASK_SERVICE, operation, answer, 201, CreateGoalInternalResponse);
    const version = versionOf(operation, answer);
    if (
      version !== goal.version ||
      answer.headers.get('Location') !== `/v1/goals/${goal.id}?today=${params.today}`
    ) {
      throw outsideContract(TASK_SERVICE, operation, 'an inconsistent goal Location or ETag');
    }
    return { body: goal, version };
  }

  /** Reads a goal and its current aggregate version. */
  public getGoal(
    goalId: string,
    query: unknown,
  ): Promise<VersionedBody<typeof GetGoalInternalResponse>> {
    const operation = 'getGoalInternal';
    return versionedBody(
      operation,
      GetGoalInternalResponse,
      this.routes.getGoalInternal(goalId, toRequest(operation, GetGoalInternalQueryParams, query)),
      (body) => body.version,
    );
  }

  /** Updates a goal under the provided condition. */
  public updateGoal(
    goalId: string,
    body: unknown,
    query: unknown,
    ifMatch?: string,
  ): Promise<VersionedBody<typeof UpdateGoalInternalResponse>> {
    const operation = 'updateGoalInternal';
    return versionedBody(
      operation,
      UpdateGoalInternalResponse,
      this.routes.updateGoalInternal(
        goalId,
        toRequest(operation, UpdateGoalInternalBody, body),
        toRequest(operation, UpdateGoalInternalQueryParams, query),
        sentOnce(withHeaders('If-Match', ifMatch)),
      ),
      (value) => value.version,
    );
  }

  /** Deletes a goal once. */
  public deleteGoal(goalId: string, ifMatch?: string): Promise<void> {
    return acknowledged(
      'deleteGoalInternal',
      204,
      this.routes.deleteGoalInternal(goalId, sentOnce(withHeaders('If-Match', ifMatch))),
    );
  }

  /** Adds a key result and returns the parent goal version. */
  public async createGoalResult(
    goalId: string,
    body: unknown,
    ifMatch?: string,
    key?: string,
  ): Promise<VersionedBody<typeof CreateGoalResultInternalResponse>> {
    const operation = 'createGoalResultInternal';
    const headers: Record<string, string> = {};
    if (ifMatch !== undefined) headers['If-Match'] = ifMatch;
    if (key !== undefined) headers['Idempotency-Key'] = key;
    const answer = await answered(
      TASK_SERVICE,
      operation,
      this.routes.createGoalResultInternal(
        goalId,
        toRequest(operation, CreateGoalResultInternalBody, body),
        sentOnce({ headers }),
      ),
    );
    const result = expectBody(
      TASK_SERVICE,
      operation,
      answer,
      201,
      CreateGoalResultInternalResponse,
    );
    const version = versionOf(operation, answer);
    if (
      answer.headers.get('Location')?.toLowerCase() !==
      `/v1/goals/${goalId}/results/${result.id}`.toLowerCase()
    ) {
      throw outsideContract(TASK_SERVICE, operation, 'an inconsistent goal result Location');
    }
    return { body: result, version };
  }

  /** Reads a result and its parent goal version. */
  public async getGoalResult(
    goalId: string,
    resultId: string,
  ): Promise<VersionedBody<typeof GetGoalResultInternalResponse>> {
    const operation = 'getGoalResultInternal';
    const answer = await answered(
      TASK_SERVICE,
      operation,
      this.routes.getGoalResultInternal(goalId, resultId),
    );
    return {
      body: expectBody(TASK_SERVICE, operation, answer, 200, GetGoalResultInternalResponse),
      version: versionOf(operation, answer),
    };
  }

  /** Updates one result under its goal version. */
  public async updateGoalResult(
    goalId: string,
    resultId: string,
    body: unknown,
    ifMatch?: string,
  ): Promise<VersionedBody<typeof UpdateGoalResultInternalResponse>> {
    const operation = 'updateGoalResultInternal';
    const answer = await answered(
      TASK_SERVICE,
      operation,
      this.routes.updateGoalResultInternal(
        goalId,
        resultId,
        toRequest(operation, UpdateGoalResultInternalBody, body),
        sentOnce(withHeaders('If-Match', ifMatch)),
      ),
    );
    return {
      body: expectBody(TASK_SERVICE, operation, answer, 200, UpdateGoalResultInternalResponse),
      version: versionOf(operation, answer),
    };
  }

  /** Deletes one result under its goal version. */
  public deleteGoalResult(goalId: string, resultId: string, ifMatch?: string): Promise<void> {
    return acknowledged(
      'deleteGoalResultInternal',
      204,
      this.routes.deleteGoalResultInternal(
        goalId,
        resultId,
        sentOnce(withHeaders('If-Match', ifMatch)),
      ),
    );
  }

  /** Reads a sprint report page. */
  public getSprintReport(
    listId: string,
    query: unknown,
  ): Promise<z.output<typeof GetSprintReportInternalResponse>> {
    const operation = 'getSprintReportInternal';
    return call(
      operation,
      200,
      GetSprintReportInternalResponse,
      this.routes.getSprintReportInternal(
        listId,
        toRequest(operation, GetSprintReportInternalQueryParams, query),
      ),
    );
  }

  /** Reads a list's workload. */
  public getListWorkload(
    listId: string,
    query: unknown,
  ): Promise<z.output<typeof GetListWorkloadInternalResponse>> {
    const operation = 'getListWorkloadInternal';
    return call(
      operation,
      200,
      GetListWorkloadInternalResponse,
      this.routes.getListWorkloadInternal(
        listId,
        toRequest(operation, GetListWorkloadInternalQueryParams, query),
      ),
    );
  }

  /** Reads a weekly list timesheet. */
  public getListTimesheet(
    listId: string,
    query: unknown,
  ): Promise<z.output<typeof GetListTimesheetInternalResponse>> {
    const operation = 'getListTimesheetInternal';
    return call(
      operation,
      200,
      GetListTimesheetInternalResponse,
      this.routes.getListTimesheetInternal(
        listId,
        toRequest(operation, GetListTimesheetInternalQueryParams, query),
      ),
    );
  }

  /** Opens the authorized NDJSON projection with a bounded body deadline and no retry. */
  public async exportListTasks(
    listId: string,
    query: unknown,
    signal?: AbortSignal,
  ): Promise<AsyncIterable<TaskCsvExportFrame>> {
    const operation = 'exportListTasksInternal';
    const params = toRequest(operation, ExportListTasksInternalParams, { listId });
    const url = this.routes.getExportListTasksInternalUrl(
      params.listId,
      toRequest(operation, ExportListTasksInternalQueryParams, query),
    );
    const init: InternalRequestInit = {
      method: 'GET',
      headers: { Accept: TASK_CSV_NDJSON },
      idempotent: false,
      streamTimeoutMs: 120_000,
      signal,
    };
    return readTaskCsvExport(await this.http.fetch(url, init), signal);
  }

  /** Reads the visible team dashboard. */
  public getTeamDashboard(
    query: unknown,
  ): Promise<z.output<typeof GetTeamDashboardInternalResponse>> {
    const operation = 'getTeamDashboardInternal';
    return call(
      operation,
      200,
      GetTeamDashboardInternalResponse,
      this.routes.getTeamDashboardInternal(
        toRequest(operation, GetTeamDashboardInternalQueryParams, query),
      ),
    );
  }

  /** Reads the editable intake settings and their version. */
  public getIntakeFormConfiguration(
    listId: string,
  ): Promise<VersionedBody<typeof GetIntakeFormConfigurationInternalResponse>> {
    const operation = 'getIntakeFormConfigurationInternal';
    return versionedBody(
      operation,
      GetIntakeFormConfigurationInternalResponse,
      this.routes.getIntakeFormConfigurationInternal(listId),
      (body) => body.version,
    );
  }

  /** Updates intake settings under the supplied version. */
  public updateIntakeFormConfiguration(
    listId: string,
    body: unknown,
    ifMatch?: string,
  ): Promise<VersionedBody<typeof UpdateIntakeFormConfigurationInternalResponse>> {
    const operation = 'updateIntakeFormConfigurationInternal';
    return versionedBody(
      operation,
      UpdateIntakeFormConfigurationInternalResponse,
      this.routes.updateIntakeFormConfigurationInternal(
        listId,
        toRequest(operation, UpdateIntakeFormConfigurationInternalBody, body),
        sentOnce(withHeaders('If-Match', ifMatch)),
      ),
      (value) => value.version,
    );
  }

  /** Publishes the intake form. */
  public publishIntakeForm(
    listId: string,
    ifMatch?: string,
  ): Promise<VersionedBody<typeof PublishIntakeFormInternalResponse>> {
    const operation = 'publishIntakeFormInternal';
    return versionedBody(
      operation,
      PublishIntakeFormInternalResponse,
      this.routes.publishIntakeFormInternal(listId, sentOnce(withHeaders('If-Match', ifMatch))),
      (body) => body.version,
    );
  }

  /** Revokes the active intake publication. */
  public async disableIntakeForm(listId: string, ifMatch?: string): Promise<number> {
    const operation = 'disableIntakeFormInternal';
    const answer = await answered(
      TASK_SERVICE,
      operation,
      this.routes.disableIntakeFormInternal(listId, sentOnce(withHeaders('If-Match', ifMatch))),
    );
    expectStatus(TASK_SERVICE, operation, answer, 204);
    return versionOf(operation, answer);
  }

  /** Reads the applicant contact after task-service authorization. */
  public getTaskIntakeContact(
    taskKey: string,
  ): Promise<z.output<typeof GetTaskIntakeContactInternalResponse>> {
    return call(
      'getTaskIntakeContactInternal',
      200,
      GetTaskIntakeContactInternalResponse,
      this.routes.getTaskIntakeContactInternal(taskKey),
    );
  }

  /** Reads a public intake form as the unscoped gateway system actor. */
  public getPublicIntakeForm(
    publicKey: string,
  ): Promise<z.output<typeof GetPublicIntakeFormInternalResponse>> {
    return call(
      'getPublicIntakeFormInternal',
      200,
      GetPublicIntakeFormInternalResponse,
      this.routes.getPublicIntakeFormInternal(publicKey, intakeSystemClaims()),
    );
  }

  /** Obtains a trusted Task allocation for a private applicant draft. */
  public async allocateIntakeAttachment(
    publicKey: string,
    body: unknown,
    draftKey: string,
    key: string,
  ): Promise<z.output<typeof AllocateIntakeAttachmentInternalResponse>> {
    const operation = 'allocateIntakeAttachmentInternal';
    toRequest(operation, AllocateIntakeAttachmentInternalParams, { publicKey });
    toRequest(operation, AllocateIntakeAttachmentInternalHeader, {
      'Intake-Draft-Key': draftKey,
      'Idempotency-Key': key,
    });
    const pathKey = encodeURIComponent(publicKey);
    const answer = await answered(
      TASK_SERVICE,
      operation,
      this.routes.allocateIntakeAttachmentInternal(
        pathKey,
        toRequest(operation, AllocateIntakeAttachmentInternalBody, body),
        sentOnce(intakeSystemClaims(draftKey, key)),
      ),
    );
    const proof = expectBody(
      TASK_SERVICE,
      operation,
      answer,
      201,
      AllocateIntakeAttachmentInternalResponse,
    );
    requireIntakeNoStore(operation, answer.headers);
    const location = answer.headers.get('Location');
    const requestPath = `/internal/v1/intake-forms/${pathKey}/attachments`;
    const prefix = `${requestPath}/`;
    const parsed =
      location === null ? null : URL.parse(location, `https://task.invalid${requestPath}`);
    if (
      location === null ||
      /^(?:[a-z][a-z\d+.-]*:|\/\/)|[\s\\?#]/iu.test(location) ||
      !parsed?.pathname.startsWith(prefix) ||
      parsed.pathname.slice(prefix.length).toLowerCase() !== proof.attachmentId.toLowerCase()
    ) {
      throw outsideContract(TASK_SERVICE, operation, 'an inconsistent allocation Location');
    }
    return proof;
  }

  /** Obtains current completion authorization for the requested reservation. */
  public async resolveIntakeAttachment(
    publicKey: string,
    attachmentId: string,
    draftKey: string,
  ): Promise<z.output<typeof ResolveIntakeAttachmentInternalResponse>> {
    const operation = 'resolveIntakeAttachmentInternal';
    toRequest(operation, ResolveIntakeAttachmentInternalParams, { publicKey, attachmentId });
    toRequest(operation, ResolveIntakeAttachmentInternalHeader, { 'Intake-Draft-Key': draftKey });
    const answer = await answered(
      TASK_SERVICE,
      operation,
      this.routes.resolveIntakeAttachmentInternal(
        encodeURIComponent(publicKey),
        attachmentId,
        intakeSystemClaims(draftKey),
      ),
    );
    const proof = expectBody(
      TASK_SERVICE,
      operation,
      answer,
      200,
      ResolveIntakeAttachmentInternalResponse,
    );
    requireIntakeNoStore(operation, answer.headers);
    if (proof.attachmentId.toLowerCase() !== attachmentId.toLowerCase()) {
      throw outsideContract(TASK_SERVICE, operation, 'an inconsistent allocation identity');
    }
    return proof;
  }

  /** Requests the authoritative release once on behalf of the applicant. */
  public async releaseIntakeAttachment(
    publicKey: string,
    attachmentId: string,
    draftKey: string,
  ): Promise<void> {
    const operation = 'releaseIntakeAttachmentInternal';
    toRequest(operation, ReleaseIntakeAttachmentInternalParams, { publicKey, attachmentId });
    toRequest(operation, ReleaseIntakeAttachmentInternalHeader, { 'Intake-Draft-Key': draftKey });
    const answer = await answered(
      TASK_SERVICE,
      operation,
      this.routes.releaseIntakeAttachmentInternal(
        encodeURIComponent(publicKey),
        attachmentId,
        sentOnce(intakeSystemClaims(draftKey)),
      ),
    );
    expectStatus(TASK_SERVICE, operation, answer, 204);
    requireIntakeNoStore(operation, answer.headers);
  }

  /** Submits to a public intake form once with the supplied replay key. */
  public submitPublicIntakeForm(
    publicKey: string,
    body: unknown,
    key?: string,
    draftKey?: string,
  ): Promise<z.output<typeof SubmitPublicIntakeFormInternalResponse>> {
    const operation = 'submitPublicIntakeFormInternal';
    const options = intakeSystemClaims(draftKey, key);
    toRequest(operation, SubmitPublicIntakeFormInternalHeader, options.headers);
    return call(
      operation,
      200,
      SubmitPublicIntakeFormInternalResponse,
      this.routes.submitPublicIntakeFormInternal(
        publicKey,
        toRequest(operation, SubmitPublicIntakeFormInternalBody, body),
        sentOnce(options),
      ),
    );
  }

  /**
   * Method listSpaces
   *
   * @description
   * `GET /internal/v1/spaces`.
   *
   * @param {unknown} query - Cursor and page size.
   * @returns {Promise<z.output<typeof ListSpacesInternalResponse>>} One page of spaces.
   */
  public listSpaces(query: unknown): Promise<z.output<typeof ListSpacesInternalResponse>> {
    const operation = 'listSpacesInternal';
    return call(
      operation,
      200,
      ListSpacesInternalResponse,
      this.routes.listSpacesInternal(toRequest(operation, ListSpacesInternalQueryParams, query)),
    );
  }

  /**
   * Method createSpace
   *
   * @description
   * `POST /internal/v1/spaces`, with the `Idempotency-Key` of the public request.
   *
   * @param {unknown} creation - The space to create.
   * @param {string | undefined} idempotencyKey - `Idempotency-Key` of the public request.
   * @returns {Promise<z.output<typeof CreateSpaceInternalResponse>>} The space and its first list.
   */
  public createSpace(
    creation: unknown,
    idempotencyKey: string | undefined,
  ): Promise<z.output<typeof CreateSpaceInternalResponse>> {
    const operation = 'createSpaceInternal';
    return call(
      operation,
      201,
      CreateSpaceInternalResponse,
      this.routes.createSpaceInternal(
        toRequest(operation, CreateSpaceInternalBody, creation),
        withHeaders('Idempotency-Key', idempotencyKey),
      ),
    );
  }

  /**
   * Method getSpace
   *
   * @description
   * `GET /internal/v1/spaces/{spaceId}`.
   *
   * @param {string} spaceId - Id of the space.
   * @returns {Promise<z.output<typeof GetSpaceInternalResponse>>} The space.
   */
  public getSpace(spaceId: string): Promise<z.output<typeof GetSpaceInternalResponse>> {
    return call(
      'getSpaceInternal',
      200,
      GetSpaceInternalResponse,
      this.routes.getSpaceInternal(spaceId),
    );
  }

  /**
   * Method updateSpace
   *
   * @description
   * `PATCH /internal/v1/spaces/{spaceId}`, with the `If-Match` of the public request. Never
   * retried.
   *
   * @param {string} spaceId - Id of the space.
   * @param {unknown} patch - JSON Merge Patch of the space.
   * @param {string | undefined} ifMatch - `If-Match` of the public request.
   * @returns {Promise<z.output<typeof UpdateSpaceInternalResponse>>} The space after the change.
   */
  public updateSpace(
    spaceId: string,
    patch: unknown,
    ifMatch: string | undefined,
  ): Promise<z.output<typeof UpdateSpaceInternalResponse>> {
    const operation = 'updateSpaceInternal';
    return call(
      operation,
      200,
      UpdateSpaceInternalResponse,
      this.routes.updateSpaceInternal(
        spaceId,
        toRequest(operation, UpdateSpaceInternalBody, patch),
        sentOnce(withHeaders('If-Match', ifMatch)),
      ),
    );
  }

  /**
   * Method deleteSpace
   *
   * @description
   * `DELETE /internal/v1/spaces/{spaceId}`, with the `If-Match` of the public request: `204`
   * without `ETag`. Its lists go with it and its tasks move to the trash. Never retried, with or
   * without `If-Match`.
   *
   * @param {string} spaceId - Id of the space.
   * @param {string | undefined} ifMatch - `If-Match` of the public request.
   * @returns {Promise<void>} Once the space is deleted.
   */
  public deleteSpace(spaceId: string, ifMatch: string | undefined): Promise<void> {
    const operation = 'deleteSpaceInternal';
    return acknowledged(
      operation,
      204,
      this.routes.deleteSpaceInternal(spaceId, sentOnce(withHeaders('If-Match', ifMatch))),
    );
  }

  /**
   * Method getSpaceOverview
   *
   * @description
   * `GET /internal/v1/spaces/{spaceId}/overview`, with the `today` of the caller.
   *
   * @param {string} spaceId - Id of the space.
   * @param {unknown} query - `today`, cursor and page size.
   * @returns {Promise<z.output<typeof GetSpaceOverviewInternalResponse>>} The overview.
   */
  public getSpaceOverview(
    spaceId: string,
    query: unknown,
  ): Promise<z.output<typeof GetSpaceOverviewInternalResponse>> {
    const operation = 'getSpaceOverviewInternal';
    return call(
      operation,
      200,
      GetSpaceOverviewInternalResponse,
      this.routes.getSpaceOverviewInternal(
        spaceId,
        toRequest(operation, GetSpaceOverviewInternalQueryParams, query),
      ),
    );
  }

  /**
   * Method createList
   *
   * @description
   * `POST /internal/v1/spaces/{spaceId}/lists`, with the `Idempotency-Key` of the public request.
   *
   * @param {string} spaceId - Id of the space.
   * @param {unknown} creation - The list to create.
   * @param {string | undefined} idempotencyKey - `Idempotency-Key` of the public request.
   * @returns {Promise<z.output<typeof CreateListInternalResponse>>} The list.
   */
  public createList(
    spaceId: string,
    creation: unknown,
    idempotencyKey: string | undefined,
  ): Promise<z.output<typeof CreateListInternalResponse>> {
    const operation = 'createListInternal';
    return call(
      operation,
      201,
      CreateListInternalResponse,
      this.routes.createListInternal(
        spaceId,
        toRequest(operation, CreateListInternalBody, creation),
        withHeaders('Idempotency-Key', idempotencyKey),
      ),
    );
  }

  /**
   * Method listLists
   *
   * @description
   * `GET /internal/v1/spaces/{spaceId}/lists`.
   *
   * @param {string} spaceId - Id of the space.
   * @param {unknown} query - Cursor and page size.
   * @returns {Promise<z.output<typeof ListListsInternalResponse>>} One page of lists.
   */
  public listLists(
    spaceId: string,
    query: unknown,
  ): Promise<z.output<typeof ListListsInternalResponse>> {
    const operation = 'listListsInternal';
    return call(
      operation,
      200,
      ListListsInternalResponse,
      this.routes.listListsInternal(
        spaceId,
        toRequest(operation, ListListsInternalQueryParams, query),
      ),
    );
  }

  /**
   * Method getList
   *
   * @description
   * `GET /internal/v1/lists/{listId}`.
   *
   * @param {string} listId - Id of the list.
   * @returns {Promise<z.output<typeof GetListInternalResponse>>} The list.
   */
  public getList(listId: string): Promise<z.output<typeof GetListInternalResponse>> {
    return call(
      'getListInternal',
      200,
      GetListInternalResponse,
      this.routes.getListInternal(listId),
    );
  }

  /**
   * Method updateList
   *
   * @description
   * `PATCH /internal/v1/lists/{listId}`, with the `If-Match` of the public request. Never
   * retried.
   *
   * @param {string} listId - Id of the list.
   * @param {unknown} patch - JSON Merge Patch of the list.
   * @param {string | undefined} ifMatch - `If-Match` of the public request.
   * @returns {Promise<z.output<typeof UpdateListInternalResponse>>} The list after the change.
   */
  public updateList(
    listId: string,
    patch: unknown,
    ifMatch: string | undefined,
  ): Promise<z.output<typeof UpdateListInternalResponse>> {
    const operation = 'updateListInternal';
    return call(
      operation,
      200,
      UpdateListInternalResponse,
      this.routes.updateListInternal(
        listId,
        toRequest(operation, UpdateListInternalBody, patch),
        sentOnce(withHeaders('If-Match', ifMatch)),
      ),
    );
  }

  /**
   * Method deleteList
   *
   * @description
   * `DELETE /internal/v1/lists/{listId}`, with the `If-Match` of the public request: `204`
   * without `ETag`. Never retried, with or without `If-Match`.
   *
   * @param {string} listId - Id of the list.
   * @param {string | undefined} ifMatch - `If-Match` of the public request.
   * @returns {Promise<void>} Once the list is deleted.
   */
  public deleteList(listId: string, ifMatch: string | undefined): Promise<void> {
    const operation = 'deleteListInternal';
    return acknowledged(
      operation,
      204,
      this.routes.deleteListInternal(listId, sentOnce(withHeaders('If-Match', ifMatch))),
    );
  }

  /**
   * Method getListCounts
   *
   * @description
   * `GET /internal/v1/lists/{listId}/counts`, with the `today` of the caller.
   *
   * @param {string} listId - Id of the list.
   * @param {unknown} query - `today`.
   * @returns {Promise<z.output<typeof GetListCountsInternalResponse>>} The counts of the list.
   */
  public getListCounts(
    listId: string,
    query: unknown,
  ): Promise<z.output<typeof GetListCountsInternalResponse>> {
    const operation = 'getListCountsInternal';
    return call(
      operation,
      200,
      GetListCountsInternalResponse,
      this.routes.getListCountsInternal(
        listId,
        toRequest(operation, GetListCountsInternalQueryParams, query),
      ),
    );
  }

  /**
   * Method listListActivity
   *
   * @description
   * `GET /internal/v1/lists/{listId}/activity`.
   *
   * @param {string} listId - Id of the list.
   * @param {unknown} query - Kinds, actors, cursor and page size.
   * @returns {Promise<z.output<typeof ListListActivityInternalResponse>>} One page of entries.
   */
  public listListActivity(
    listId: string,
    query: unknown,
  ): Promise<z.output<typeof ListListActivityInternalResponse>> {
    const operation = 'listListActivityInternal';
    return call(
      operation,
      200,
      ListListActivityInternalResponse,
      this.routes.listListActivityInternal(
        listId,
        toRequest(operation, ListListActivityInternalQueryParams, query),
      ),
    );
  }

  /** Lists the current actor's favorites. */
  public listFavorites(query: unknown): Promise<z.output<typeof ListFavoritesInternalResponse>> {
    const operation = 'listFavoritesInternal';
    return call(
      operation,
      200,
      ListFavoritesInternalResponse,
      this.routes.listFavoritesInternal(
        toRequest(operation, ListFavoritesInternalQueryParams, query),
      ),
    );
  }

  /** Creates a favorite once and checks its location and version. */
  public async createFavorite(
    body: unknown,
    key: string | undefined,
  ): Promise<z.output<typeof CreateFavoriteInternalResponse>> {
    const operation = 'createFavoriteInternal';
    const answer: GeneratedAnswer = await answered(
      TASK_SERVICE,
      operation,
      this.routes.createFavoriteInternal(
        toRequest(operation, CreateFavoriteInternalBody, body),
        sentOnce(withHeaders('Idempotency-Key', key)),
      ),
    );
    const favorite = expectBody(
      TASK_SERVICE,
      operation,
      answer,
      201,
      CreateFavoriteInternalResponse,
    );
    if (
      (answer.headers.get('Location') ?? '').toLowerCase() !==
        `/internal/v1/me/favorites/${favorite.id}`.toLowerCase() ||
      versionOf(operation, answer) !== favorite.version
    ) {
      throw outsideContract(TASK_SERVICE, operation, 'inconsistent Location or ETag');
    }
    return favorite;
  }

  /** Reads a favorite and checks its identity and version. */
  public async getFavorite(
    favoriteId: string,
  ): Promise<z.output<typeof GetFavoriteInternalResponse>> {
    const operation = 'getFavoriteInternal';
    const answer: GeneratedAnswer = await answered(
      TASK_SERVICE,
      operation,
      this.routes.getFavoriteInternal(favoriteId),
    );
    const favorite = expectBody(TASK_SERVICE, operation, answer, 200, GetFavoriteInternalResponse);
    if (
      favorite.id.toLowerCase() !== favoriteId.toLowerCase() ||
      versionOf(operation, answer) !== favorite.version
    ) {
      throw outsideContract(TASK_SERVICE, operation, 'inconsistent favorite identity or ETag');
    }
    return favorite;
  }

  /** Deletes a favorite once with an optional version precondition. */
  public deleteFavorite(favoriteId: string, ifMatch: string | undefined): Promise<void> {
    return acknowledged(
      'deleteFavoriteInternal',
      204,
      this.routes.deleteFavoriteInternal(favoriteId, sentOnce(withHeaders('If-Match', ifMatch))),
    );
  }

  /** Lists a page of saved views for a list. */
  public listSavedViews(
    listId: string,
    query: unknown,
  ): Promise<z.output<typeof ListSavedViewsInternalResponse>> {
    const operation = 'listSavedViewsInternal';
    return call(
      operation,
      200,
      ListSavedViewsInternalResponse,
      this.routes.listSavedViewsInternal(
        listId,
        toRequest(operation, ListSavedViewsInternalQueryParams, query),
      ),
    );
  }

  /** Creates a view once, validating its scoped location and version. */
  public async createSavedView(
    listId: string,
    body: unknown,
    key: string | undefined,
  ): Promise<z.output<typeof CreateSavedViewInternalResponse>> {
    const operation = 'createSavedViewInternal';
    const answer: GeneratedAnswer = await answered(
      TASK_SERVICE,
      operation,
      this.routes.createSavedViewInternal(
        listId,
        toRequest(operation, CreateSavedViewInternalBody, body),
        sentOnce(withHeaders('Idempotency-Key', key)),
      ),
    );
    const view = expectBody(TASK_SERVICE, operation, answer, 201, CreateSavedViewInternalResponse);
    if (
      view.listId.toLowerCase() !== listId.toLowerCase() ||
      (answer.headers.get('Location') ?? '').toLowerCase() !==
        `/internal/v1/lists/${listId}/saved-views/${view.id}`.toLowerCase() ||
      versionOf(operation, answer) !== view.version
    )
      throw outsideContract(TASK_SERVICE, operation, 'inconsistent Location, list or ETag');
    return view;
  }

  /** Reads a view and checks its identity and version. */
  public async getSavedView(
    listId: string,
    viewId: string,
  ): Promise<z.output<typeof GetSavedViewInternalResponse>> {
    const operation = 'getSavedViewInternal';
    const answer: GeneratedAnswer = await answered(
      TASK_SERVICE,
      operation,
      this.routes.getSavedViewInternal(listId, viewId),
    );
    const view = expectBody(TASK_SERVICE, operation, answer, 200, GetSavedViewInternalResponse);
    if (
      view.listId.toLowerCase() !== listId.toLowerCase() ||
      view.id.toLowerCase() !== viewId.toLowerCase() ||
      versionOf(operation, answer) !== view.version
    )
      throw outsideContract(TASK_SERVICE, operation, 'inconsistent view identity or ETag');
    return view;
  }

  /** Updates a view once with its optional precondition. */
  public async updateSavedView(
    listId: string,
    viewId: string,
    body: unknown,
    ifMatch: string | undefined,
  ): Promise<z.output<typeof UpdateSavedViewInternalResponse>> {
    const operation = 'updateSavedViewInternal';
    const answer: GeneratedAnswer = await answered(
      TASK_SERVICE,
      operation,
      this.routes.updateSavedViewInternal(
        listId,
        viewId,
        toRequest(operation, UpdateSavedViewInternalBody, body),
        sentOnce(withHeaders('If-Match', ifMatch)),
      ),
    );
    const view = expectBody(TASK_SERVICE, operation, answer, 200, UpdateSavedViewInternalResponse);
    if (
      view.listId.toLowerCase() !== listId.toLowerCase() ||
      view.id.toLowerCase() !== viewId.toLowerCase() ||
      versionOf(operation, answer) !== view.version
    )
      throw outsideContract(TASK_SERVICE, operation, 'inconsistent view identity or ETag');
    return view;
  }

  /** Deletes a view once with its optional precondition. */
  public deleteSavedView(
    listId: string,
    viewId: string,
    ifMatch: string | undefined,
  ): Promise<void> {
    return acknowledged(
      'deleteSavedViewInternal',
      204,
      this.routes.deleteSavedViewInternal(
        listId,
        viewId,
        sentOnce(withHeaders('If-Match', ifMatch)),
      ),
    );
  }

  /** Duplicates a view once, validating its scoped location and version. */
  public async duplicateSavedView(
    listId: string,
    viewId: string,
    body: unknown,
    ifMatch: string | undefined,
    key: string | undefined,
  ): Promise<z.output<typeof DuplicateSavedViewInternalResponse>> {
    const operation = 'duplicateSavedViewInternal';
    const headers: Record<string, string> = {};
    if (ifMatch !== undefined) headers['If-Match'] = ifMatch;
    if (key !== undefined) headers['Idempotency-Key'] = key;
    const answer: GeneratedAnswer = await answered(
      TASK_SERVICE,
      operation,
      this.routes.duplicateSavedViewInternal(
        listId,
        viewId,
        toRequest(operation, DuplicateSavedViewInternalBody, body),
        sentOnce({ headers }),
      ),
    );
    const view = expectBody(
      TASK_SERVICE,
      operation,
      answer,
      201,
      DuplicateSavedViewInternalResponse,
    );
    if (
      view.listId.toLowerCase() !== listId.toLowerCase() ||
      (answer.headers.get('Location') ?? '').toLowerCase() !==
        `/internal/v1/lists/${listId}/saved-views/${view.id}`.toLowerCase() ||
      versionOf(operation, answer) !== view.version
    )
      throw outsideContract(TASK_SERVICE, operation, 'inconsistent Location, list or ETag');
    return view;
  }

  /** Lists a page of task templates in a space. */
  public listTaskTemplates(
    spaceId: string,
    query: unknown,
  ): Promise<z.output<typeof ListTaskTemplatesInternalResponse>> {
    const operation = 'listTaskTemplatesInternal';
    return call(
      operation,
      200,
      ListTaskTemplatesInternalResponse,
      this.routes.listTaskTemplatesInternal(
        spaceId,
        toRequest(operation, ListTaskTemplatesInternalQueryParams, query),
      ),
    );
  }

  /** Creates a template once and checks its location and version. */
  public async createTaskTemplate(
    spaceId: string,
    body: unknown,
    key: string | undefined,
  ): Promise<z.output<typeof CreateTaskTemplateInternalResponse>> {
    const operation = 'createTaskTemplateInternal';
    const answer: GeneratedAnswer = await answered(
      TASK_SERVICE,
      operation,
      this.routes.createTaskTemplateInternal(
        spaceId,
        toRequest(operation, CreateTaskTemplateInternalBody, body),
        sentOnce(withHeaders('Idempotency-Key', key)),
      ),
    );
    const template = expectBody(
      TASK_SERVICE,
      operation,
      answer,
      201,
      CreateTaskTemplateInternalResponse,
    );
    if (
      template.spaceId.toLowerCase() !== spaceId.toLowerCase() ||
      (answer.headers.get('Location') ?? '').toLowerCase() !==
        `/internal/v1/spaces/${spaceId}/task-templates/${template.id}`.toLowerCase() ||
      versionOf(operation, answer) !== template.version
    ) {
      throw outsideContract(TASK_SERVICE, operation, 'inconsistent Location, space or ETag');
    }
    return template;
  }

  /** Reads a template and checks its version header. */
  public async getTaskTemplate(
    spaceId: string,
    templateId: string,
  ): Promise<z.output<typeof GetTaskTemplateInternalResponse>> {
    const operation = 'getTaskTemplateInternal';
    const answer: GeneratedAnswer = await answered(
      TASK_SERVICE,
      operation,
      this.routes.getTaskTemplateInternal(spaceId, templateId),
    );
    const template = expectBody(
      TASK_SERVICE,
      operation,
      answer,
      200,
      GetTaskTemplateInternalResponse,
    );
    if (
      template.spaceId.toLowerCase() !== spaceId.toLowerCase() ||
      template.id.toLowerCase() !== templateId.toLowerCase() ||
      versionOf(operation, answer) !== template.version
    ) {
      throw outsideContract(TASK_SERVICE, operation, 'inconsistent template identity or ETag');
    }
    return template;
  }

  /** Deletes a template once with an optional precondition. */
  public deleteTaskTemplate(
    spaceId: string,
    templateId: string,
    ifMatch: string | undefined,
  ): Promise<void> {
    return acknowledged(
      'deleteTaskTemplateInternal',
      204,
      this.routes.deleteTaskTemplateInternal(
        spaceId,
        templateId,
        sentOnce(withHeaders('If-Match', ifMatch)),
      ),
    );
  }

  /** Reads a page of visible milestones in a space. */
  public listSpaceMilestones(
    spaceId: string,
    query: unknown,
  ): Promise<z.output<typeof ListSpaceMilestonesInternalResponse>> {
    const operation = 'listSpaceMilestonesInternal';
    return call(
      operation,
      200,
      ListSpaceMilestonesInternalResponse,
      this.routes.listSpaceMilestonesInternal(
        spaceId,
        toRequest(operation, ListSpaceMilestonesInternalQueryParams, query),
      ),
    );
  }

  /** Duplicates a list once, checking its location and version headers. */
  public async duplicateList(
    listId: string,
    body: unknown,
    ifMatch: string | undefined,
    idempotencyKey: string | undefined,
  ): Promise<z.output<typeof DuplicateListInternalResponse>> {
    const operation = 'duplicateListInternal';
    const headers: Record<string, string> = {};
    if (ifMatch !== undefined) headers['If-Match'] = ifMatch;
    if (idempotencyKey !== undefined) headers['Idempotency-Key'] = idempotencyKey;
    const answer: GeneratedAnswer = await answered(
      TASK_SERVICE,
      operation,
      this.routes.duplicateListInternal(
        listId,
        toRequest(operation, DuplicateListInternalBody, body),
        sentOnce({ headers }),
      ),
    );
    const result = expectBody(TASK_SERVICE, operation, answer, 201, DuplicateListInternalResponse);
    if (
      (answer.headers.get('Location') ?? '').toLowerCase() !==
        `/internal/v1/lists/${result.list.id}`.toLowerCase() ||
      versionOf(operation, answer) !== result.list.version
    ) {
      throw outsideContract(TASK_SERVICE, operation, 'inconsistent Location or ETag');
    }
    return result;
  }

  /** Duplicates a task once, checking its location and version headers. */
  public async duplicateTask(
    taskKey: string,
    body: unknown,
    ifMatch: string | undefined,
    idempotencyKey: string | undefined,
  ): Promise<z.output<typeof DuplicateTaskInternalResponse>> {
    const operation = 'duplicateTaskInternal';
    const headers: Record<string, string> = {};
    if (ifMatch !== undefined) headers['If-Match'] = ifMatch;
    if (idempotencyKey !== undefined) headers['Idempotency-Key'] = idempotencyKey;
    const answer: GeneratedAnswer = await answered(
      TASK_SERVICE,
      operation,
      this.routes.duplicateTaskInternal(
        taskKey,
        toRequest(operation, DuplicateTaskInternalBody, body),
        sentOnce({ headers }),
      ),
    );
    const result = expectBody(TASK_SERVICE, operation, answer, 201, DuplicateTaskInternalResponse);
    if (
      answer.headers.get('Location') !== `/internal/v1/tasks/${result.key}` ||
      versionOf(operation, answer) !== result.version
    ) {
      throw outsideContract(TASK_SERVICE, operation, 'inconsistent Location or ETag');
    }
    return result;
  }

  /** Applies a bulk action once with the caller's idempotency key. */
  public executeBulkTaskAction(
    body: unknown,
    idempotencyKey: string | undefined,
  ): Promise<z.output<typeof ExecuteBulkTaskActionInternalResponse>> {
    const operation = 'executeBulkTaskActionInternal';
    return call(
      operation,
      200,
      ExecuteBulkTaskActionInternalResponse,
      this.routes.executeBulkTaskActionInternal(
        toRequest(operation, ExecuteBulkTaskActionInternalBody, body),
        sentOnce(withHeaders('Idempotency-Key', idempotencyKey)),
      ),
    );
  }

  /**
   * Method listTasks
   *
   * @description
   * `GET /internal/v1/lists/{listId}/tasks`, the array filters comma-separated.
   *
   * @param {string} listId - Id of the list.
   * @param {unknown} query - Filters, sort, cursor and page size.
   * @returns {Promise<z.output<typeof ListTasksInternalResponse>>} One page of tasks.
   */
  public listTasks(
    listId: string,
    query: unknown,
  ): Promise<z.output<typeof ListTasksInternalResponse>> {
    const operation = 'listTasksInternal';
    return call(
      operation,
      200,
      ListTasksInternalResponse,
      this.routes.listTasksInternal(
        listId,
        toRequest(operation, ListTasksInternalQueryParams, query),
      ),
    );
  }

  /**
   * Method createTask
   *
   * @description
   * `POST /internal/v1/lists/{listId}/tasks`, with the `Idempotency-Key` of the public request.
   *
   * @param {string} listId - Id of the list.
   * @param {unknown} creation - The task and its subtasks.
   * @param {string | undefined} idempotencyKey - `Idempotency-Key` of the public request.
   * @returns {Promise<z.output<typeof CreateTaskInternalResponse>>} The task.
   */
  public createTask(
    listId: string,
    creation: unknown,
    idempotencyKey: string | undefined,
  ): Promise<z.output<typeof CreateTaskInternalResponse>> {
    const operation = 'createTaskInternal';
    return call(
      operation,
      201,
      CreateTaskInternalResponse,
      this.routes.createTaskInternal(
        listId,
        toRequest(operation, CreateTaskInternalBody, creation),
        withHeaders('Idempotency-Key', idempotencyKey),
      ),
    );
  }

  /**
   * Method countTaskGroups
   *
   * @description
   * `GET /internal/v1/lists/{listId}/task-groups`.
   *
   * @param {string} listId - Id of the list.
   * @param {unknown} query - Grouping, filters, cursor and page size.
   * @returns {Promise<z.output<typeof CountTaskGroupsInternalResponse>>} One page of groups.
   */
  public countTaskGroups(
    listId: string,
    query: unknown,
  ): Promise<z.output<typeof CountTaskGroupsInternalResponse>> {
    const operation = 'countTaskGroupsInternal';
    return call(
      operation,
      200,
      CountTaskGroupsInternalResponse,
      this.routes.countTaskGroupsInternal(
        listId,
        toRequest(operation, CountTaskGroupsInternalQueryParams, query),
      ),
    );
  }

  /**
   * Method getTask
   *
   * @description
   * `GET /internal/v1/tasks/{taskKey}`.
   *
   * @param {string} taskKey - Key of the task.
   * @returns {Promise<z.output<typeof GetTaskInternalResponse>>} The task.
   */
  public getTask(
    taskKey: string,
    signal?: AbortSignal,
  ): Promise<z.output<typeof GetTaskInternalResponse>> {
    return call(
      'getTaskInternal',
      200,
      GetTaskInternalResponse,
      this.routes.getTaskInternal(taskKey, signal ? { signal } : undefined),
    );
  }

  /**
   * Method getTaskVisibility
   *
   * @description
   * Reads Task's visibility decisions in the current signed user and organization context.
   *
   * @param {readonly string[]} taskKeys - Distinct canonical task keys in the requested order.
   * @param {AbortSignal | undefined} signal - The history read's lifetime.
   * @returns {Promise<readonly string[]>} The visible subset in request order.
   */
  public async getTaskVisibility(
    taskKeys: readonly string[],
    signal?: AbortSignal,
  ): Promise<readonly string[]> {
    const operation = 'getTaskVisibilityInternal';
    const request = toRequest(operation, GetTaskVisibilityInternalBody, { taskKeys });
    const options: InternalRequestInit = {
      idempotent: true,
      ...(signal === undefined ? {} : { signal }),
    };
    const { visibleTaskKeys } = await call(
      operation,
      200,
      GetTaskVisibilityInternalResponse,
      this.routes.getTaskVisibilityInternal(request, options),
    );
    const positions = new Map(request.taskKeys.map((key, position) => [key, position]));
    let last = -1;
    for (const key of visibleTaskKeys) {
      const position = positions.get(key);
      if (position === undefined || position <= last) {
        throw outsideContract(TASK_SERVICE, operation, 'visible keys outside the ordered request');
      }
      last = position;
    }
    return visibleTaskKeys;
  }

  /**
   * Method updateTask
   *
   * @description
   * `PATCH /internal/v1/tasks/{taskKey}`, with the `If-Match` of the public request. Never
   * retried.
   *
   * @param {string} taskKey - Key of the task.
   * @param {unknown} patch - JSON Merge Patch of the task.
   * @param {string | undefined} ifMatch - `If-Match` of the public request.
   * @returns {Promise<z.output<typeof UpdateTaskInternalResponse>>} The task after the change.
   */
  public updateTask(
    taskKey: string,
    patch: unknown,
    ifMatch: string | undefined,
  ): Promise<z.output<typeof UpdateTaskInternalResponse>> {
    const operation = 'updateTaskInternal';
    return call(
      operation,
      200,
      UpdateTaskInternalResponse,
      this.routes.updateTaskInternal(
        taskKey,
        toRequest(operation, UpdateTaskInternalBody, patch),
        sentOnce(withHeaders('If-Match', ifMatch)),
      ),
    );
  }

  /**
   * Method getTaskDetail
   *
   * @description
   * `GET /internal/v1/tasks/{taskKey}/detail`: the part of the task detail task-service owns.
   *
   * @param {string} taskKey - Key of the task.
   * @returns {Promise<z.output<typeof GetTaskDetailInternalResponse>>} The task, its space, its
   * list, its parent and its direct subtasks.
   */
  public getTaskDetail(taskKey: string): Promise<z.output<typeof GetTaskDetailInternalResponse>> {
    return call(
      'getTaskDetailInternal',
      200,
      GetTaskDetailInternalResponse,
      this.routes.getTaskDetailInternal(taskKey),
    );
  }

  /** Reads a page of task comments from task-service. */
  public listTaskComments(
    taskKey: string,
    query: unknown,
    signal?: AbortSignal,
  ): Promise<z.output<typeof ListTaskCommentsInternalResponse>> {
    const operation = 'listTaskCommentsInternal';
    return call(
      operation,
      200,
      ListTaskCommentsInternalResponse,
      this.routes.listTaskCommentsInternal(
        taskKey,
        toRequest(operation, ListTaskCommentsInternalQueryParams, query),
        signal === undefined ? undefined : { signal },
      ),
    );
  }

  /** Creates a comment once and checks its task, location and version. */
  public async createTaskComment(
    taskKey: string,
    body: unknown,
    key: string | undefined,
  ): Promise<z.output<typeof CreateTaskCommentInternalResponse>> {
    const operation = 'createTaskCommentInternal';
    const answer: GeneratedAnswer = await answered(
      TASK_SERVICE,
      operation,
      this.routes.createTaskCommentInternal(
        taskKey,
        toRequest(operation, CreateTaskCommentInternalBody, body),
        sentOnce(withHeaders('Idempotency-Key', key)),
      ),
    );
    const comment = expectBody(
      TASK_SERVICE,
      operation,
      answer,
      201,
      CreateTaskCommentInternalResponse,
    );
    if (
      comment.taskKey !== taskKey ||
      (answer.headers.get('Location') ?? '').toLowerCase() !==
        `/internal/v1/tasks/${comment.taskKey}/comments/${comment.id}`.toLowerCase() ||
      versionOf(operation, answer) !== comment.version
    ) {
      throw outsideContract(TASK_SERVICE, operation, 'inconsistent comment task, Location or ETag');
    }
    return comment;
  }

  /** Reads a comment and checks its task, identity and version. */
  public async getTaskComment(
    taskKey: string,
    commentId: string,
  ): Promise<z.output<typeof GetTaskCommentInternalResponse>> {
    const operation = 'getTaskCommentInternal';
    const answer: GeneratedAnswer = await answered(
      TASK_SERVICE,
      operation,
      this.routes.getTaskCommentInternal(taskKey, commentId),
    );
    const comment = expectBody(
      TASK_SERVICE,
      operation,
      answer,
      200,
      GetTaskCommentInternalResponse,
    );
    if (
      comment.taskKey !== taskKey ||
      comment.id.toLowerCase() !== commentId.toLowerCase() ||
      versionOf(operation, answer) !== comment.version
    ) {
      throw outsideContract(TASK_SERVICE, operation, 'inconsistent comment identity or ETag');
    }
    return comment;
  }

  /** Changes a comment once and checks its identity and version. */
  public async updateTaskComment(
    taskKey: string,
    commentId: string,
    body: unknown,
    ifMatch: string,
  ): Promise<z.output<typeof UpdateTaskCommentInternalResponse>> {
    const operation = 'updateTaskCommentInternal';
    const answer: GeneratedAnswer = await answered(
      TASK_SERVICE,
      operation,
      this.routes.updateTaskCommentInternal(
        taskKey,
        commentId,
        toRequest(operation, UpdateTaskCommentInternalBody, body),
        sentOnce(withHeaders('If-Match', ifMatch)),
      ),
    );
    const comment = expectBody(
      TASK_SERVICE,
      operation,
      answer,
      200,
      UpdateTaskCommentInternalResponse,
    );
    if (
      comment.taskKey !== taskKey ||
      comment.id.toLowerCase() !== commentId.toLowerCase() ||
      versionOf(operation, answer) !== comment.version
    ) {
      throw outsideContract(TASK_SERVICE, operation, 'inconsistent comment identity or ETag');
    }
    return comment;
  }

  /** Deletes a comment once using the optional version precondition. */
  public deleteTaskComment(
    taskKey: string,
    commentId: string,
    ifMatch: string | undefined,
  ): Promise<void> {
    return acknowledged(
      'deleteTaskCommentInternal',
      204,
      this.routes.deleteTaskCommentInternal(
        taskKey,
        commentId,
        sentOnce(withHeaders('If-Match', ifMatch)),
      ),
    );
  }

  /** Lists the task participants eligible for mentions. */
  public listTaskParticipants(
    taskKey: string,
    query: unknown,
  ): Promise<z.output<typeof ListTaskParticipantsInternalResponse>> {
    const operation = 'listTaskParticipantsInternal';
    return call(
      operation,
      200,
      ListTaskParticipantsInternalResponse,
      this.routes.listTaskParticipantsInternal(
        taskKey,
        toRequest(operation, ListTaskParticipantsInternalQueryParams, query),
      ),
    );
  }

  /** Reads effective task watchers. */
  public listTaskWatchers(
    taskKey: string,
    query: unknown,
  ): Promise<z.output<typeof ListTaskWatchersInternalResponse>> {
    const operation = 'listTaskWatchersInternal';
    return call(
      operation,
      200,
      ListTaskWatchersInternalResponse,
      this.routes.listTaskWatchersInternal(
        taskKey,
        toRequest(operation, ListTaskWatchersInternalQueryParams, query),
      ),
    );
  }

  /** Follows once and returns the task version from the upstream ETag. */
  public async followTaskWatcher(
    taskKey: string,
    userId: string,
    body: unknown,
    ifMatch: string | undefined,
  ): Promise<{ watcher: z.output<typeof FollowTaskWatcherInternalResponse>; version: number }> {
    const operation = 'followTaskWatcherInternal';
    const answer: GeneratedAnswer = await answered(
      TASK_SERVICE,
      operation,
      this.routes.followTaskWatcherInternal(
        taskKey,
        userId,
        toRequest(operation, FollowTaskWatcherInternalBody, body),
        sentOnce(withHeaders('If-Match', ifMatch)),
      ),
    );
    const watcher = expectBody(
      TASK_SERVICE,
      operation,
      answer,
      200,
      FollowTaskWatcherInternalResponse,
    );
    if (watcher.userId.toLowerCase() !== userId.toLowerCase()) {
      throw outsideContract(TASK_SERVICE, operation, 'a watcher for another user');
    }
    return { watcher, version: versionOf(operation, answer) };
  }

  /** Unfollows once and returns the task version from the upstream ETag. */
  public async unfollowTaskWatcher(
    taskKey: string,
    userId: string,
    ifMatch: string | undefined,
  ): Promise<number> {
    const operation = 'unfollowTaskWatcherInternal';
    const answer: GeneratedAnswer = await answered(
      TASK_SERVICE,
      operation,
      this.routes.unfollowTaskWatcherInternal(
        taskKey,
        userId,
        sentOnce(withHeaders('If-Match', ifMatch)),
      ),
    );
    expectStatus(TASK_SERVICE, operation, answer, 204);
    return versionOf(operation, answer);
  }

  /** Lists the visible dependencies of the anchor task. */
  public listTaskDependencies(
    taskKey: string,
    query: unknown,
  ): Promise<z.output<typeof ListTaskDependenciesInternalResponse>> {
    const operation = 'listTaskDependenciesInternal';
    return call(
      operation,
      200,
      ListTaskDependenciesInternalResponse,
      this.routes.listTaskDependenciesInternal(
        taskKey,
        toRequest(operation, ListTaskDependenciesInternalQueryParams, query),
      ),
    );
  }

  /** Creates one dependency, validating its location and anchor version. */
  public async createTaskDependency(
    taskKey: string,
    body: unknown,
    ifMatch: string | undefined,
    key: string | undefined,
  ): Promise<{
    dependency: z.output<typeof CreateTaskDependencyInternalResponse>;
    version: number;
  }> {
    const operation = 'createTaskDependencyInternal';
    const headers: Record<string, string> = {};
    if (ifMatch !== undefined) headers['If-Match'] = ifMatch;
    if (key !== undefined) headers['Idempotency-Key'] = key;
    const answer: GeneratedAnswer = await answered(
      TASK_SERVICE,
      operation,
      this.routes.createTaskDependencyInternal(
        taskKey,
        toRequest(operation, CreateTaskDependencyInternalBody, body),
        sentOnce({ headers }),
      ),
    );
    const dependency = expectBody(
      TASK_SERVICE,
      operation,
      answer,
      201,
      CreateTaskDependencyInternalResponse,
    );
    if (
      (dependency.blocker.key !== taskKey && dependency.blocked.key !== taskKey) ||
      (answer.headers.get('Location') ?? '').toLowerCase() !==
        `/internal/v1/tasks/${taskKey}/dependencies/${dependency.id}`.toLowerCase()
    ) {
      throw outsideContract(
        TASK_SERVICE,
        operation,
        'a Location that does not name the dependency',
      );
    }
    return { dependency, version: versionOf(operation, answer) };
  }

  /** Reads one visible dependency. */
  public getTaskDependency(
    taskKey: string,
    dependencyId: string,
  ): Promise<z.output<typeof GetTaskDependencyInternalResponse>> {
    return call(
      'getTaskDependencyInternal',
      200,
      GetTaskDependencyInternalResponse,
      this.routes.getTaskDependencyInternal(taskKey, dependencyId),
    );
  }

  /** Deletes a dependency once and returns the anchor task version. */
  public async deleteTaskDependency(
    taskKey: string,
    dependencyId: string,
    ifMatch: string | undefined,
  ): Promise<number> {
    const operation = 'deleteTaskDependencyInternal';
    const answer: GeneratedAnswer = await answered(
      TASK_SERVICE,
      operation,
      this.routes.deleteTaskDependencyInternal(
        taskKey,
        dependencyId,
        sentOnce(withHeaders('If-Match', ifMatch)),
      ),
    );
    expectStatus(TASK_SERVICE, operation, answer, 204);
    return versionOf(operation, answer);
  }

  /** Lists eligible dependency candidates. */
  public listDependencyCandidates(
    taskKey: string,
    query: unknown,
  ): Promise<z.output<typeof ListDependencyCandidatesInternalResponse>> {
    const operation = 'listDependencyCandidatesInternal';
    return call(
      operation,
      200,
      ListDependencyCandidatesInternalResponse,
      this.routes.listDependencyCandidatesInternal(
        taskKey,
        toRequest(operation, ListDependencyCandidatesInternalQueryParams, query),
      ),
    );
  }

  /**
   * Method listSubtasks
   *
   * @description
   * `GET /internal/v1/tasks/{taskKey}/subtasks`.
   *
   * @param {string} taskKey - Key of the parent.
   * @param {unknown} query - Cursor and page size.
   * @returns {Promise<z.output<typeof ListSubtasksInternalResponse>>} One page of subtasks.
   */
  public listSubtasks(
    taskKey: string,
    query: unknown,
  ): Promise<z.output<typeof ListSubtasksInternalResponse>> {
    const operation = 'listSubtasksInternal';
    return call(
      operation,
      200,
      ListSubtasksInternalResponse,
      this.routes.listSubtasksInternal(
        taskKey,
        toRequest(operation, ListSubtasksInternalQueryParams, query),
      ),
    );
  }

  /**
   * Method createSubtask
   *
   * @description
   * `POST /internal/v1/tasks/{taskKey}/subtasks`, with the `Idempotency-Key` of the public
   * request.
   *
   * @param {string} taskKey - Key of the parent.
   * @param {unknown} creation - The subtask.
   * @param {string | undefined} idempotencyKey - `Idempotency-Key` of the public request.
   * @returns {Promise<z.output<typeof CreateSubtaskInternalResponse>>} The subtask.
   */
  public createSubtask(
    taskKey: string,
    creation: unknown,
    idempotencyKey: string | undefined,
  ): Promise<z.output<typeof CreateSubtaskInternalResponse>> {
    const operation = 'createSubtaskInternal';
    return call(
      operation,
      201,
      CreateSubtaskInternalResponse,
      this.routes.createSubtaskInternal(
        taskKey,
        toRequest(operation, CreateSubtaskInternalBody, creation),
        withHeaders('Idempotency-Key', idempotencyKey),
      ),
    );
  }

  /**
   * Method addChecklistItem
   *
   * @description
   * `POST /internal/v1/tasks/{taskKey}/checklist-items`, with the `Idempotency-Key` of the public
   * request. The id of the item is the last segment of the `Location` task-service answers.
   *
   * @param {string} taskKey - Key of the task.
   * @param {unknown} creation - The item.
   * @param {string | undefined} idempotencyKey - `Idempotency-Key` of the public request.
   * @returns {Promise<{ task: z.output<typeof AddChecklistItemInternalResponse>; checklistItemId: string }>}
   * The task and the id of the item.
   * @throws {ProblemException} 503 `upstream.failed` when `Location` does not name an item of the task.
   */
  public async addChecklistItem(
    taskKey: string,
    creation: unknown,
    idempotencyKey: string | undefined,
  ): Promise<{ task: z.output<typeof AddChecklistItemInternalResponse>; checklistItemId: string }> {
    const operation = 'addChecklistItemInternal';
    const answer: GeneratedAnswer = await answered(
      TASK_SERVICE,
      operation,
      this.routes.addChecklistItemInternal(
        taskKey,
        toRequest(operation, AddChecklistItemInternalBody, creation),
        withHeaders('Idempotency-Key', idempotencyKey),
      ),
    );
    const task: z.output<typeof AddChecklistItemInternalResponse> = expectBody(
      TASK_SERVICE,
      operation,
      answer,
      201,
      AddChecklistItemInternalResponse,
    );
    const location: RegExpExecArray | null = CHECKLIST_ITEM_LOCATION.exec(
      answer.headers.get('Location') ?? '',
    );
    const checklistItemId: string | undefined =
      location?.[1] === task.key ? location[2] : undefined;
    if (checklistItemId === undefined) {
      throw outsideContract(
        TASK_SERVICE,
        operation,
        'a Location that names no checklist item of the task',
      );
    }
    return { task, checklistItemId };
  }

  /**
   * Method updateChecklistItem
   *
   * @description
   * `PATCH /internal/v1/tasks/{taskKey}/checklist-items/{checklistItemId}`, with the `If-Match`
   * of the public request. Never retried.
   *
   * @param {string} taskKey - Key of the task.
   * @param {string} checklistItemId - Id of the item.
   * @param {unknown} patch - Whether the item is done.
   * @param {string | undefined} ifMatch - `If-Match` of the public request.
   * @returns {Promise<z.output<typeof UpdateChecklistItemInternalResponse>>} The task.
   */
  public updateChecklistItem(
    taskKey: string,
    checklistItemId: string,
    patch: unknown,
    ifMatch: string | undefined,
  ): Promise<z.output<typeof UpdateChecklistItemInternalResponse>> {
    const operation = 'updateChecklistItemInternal';
    return call(
      operation,
      200,
      UpdateChecklistItemInternalResponse,
      this.routes.updateChecklistItemInternal(
        taskKey,
        checklistItemId,
        toRequest(operation, UpdateChecklistItemInternalBody, patch),
        sentOnce(withHeaders('If-Match', ifMatch)),
      ),
    );
  }

  /**
   * Method assignTask
   *
   * @description
   * `PUT /internal/v1/tasks/{taskKey}/assignees/{userId}`, with the `If-Match` of the public
   * request. Never retried, with or without `If-Match`: a repeat after a lost answer would assign
   * again an account another actor unassigned in between.
   *
   * @param {string} taskKey - Key of the task.
   * @param {string} userId - Account to assign.
   * @param {string | undefined} ifMatch - `If-Match` of the public request.
   * @returns {Promise<z.output<typeof AssignTaskInternalResponse>>} The task.
   */
  public assignTask(
    taskKey: string,
    userId: string,
    ifMatch: string | undefined,
  ): Promise<z.output<typeof AssignTaskInternalResponse>> {
    return call(
      'assignTaskInternal',
      200,
      AssignTaskInternalResponse,
      this.routes.assignTaskInternal(
        taskKey,
        userId,
        EMPTY_REQUEST,
        sentOnce(withHeaders('If-Match', ifMatch)),
      ),
    );
  }

  /**
   * Method unassignTask
   *
   * @description
   * `DELETE /internal/v1/tasks/{taskKey}/assignees/{userId}`, with the `If-Match` of the public
   * request: `204` with the `ETag` of the task. Never retried, with or without `If-Match`: a
   * repeat after a lost answer would unassign an account another actor assigned in between.
   *
   * @param {string} taskKey - Key of the task.
   * @param {string} userId - Account to unassign.
   * @param {string | undefined} ifMatch - `If-Match` of the public request.
   * @returns {Promise<number>} The version of the task after the change.
   * @throws {ProblemException} 503 `upstream.failed` without a strong `ETag`.
   */
  public async unassignTask(
    taskKey: string,
    userId: string,
    ifMatch: string | undefined,
  ): Promise<number> {
    const operation = 'unassignTaskInternal';
    const answer: GeneratedAnswer = await answered(
      TASK_SERVICE,
      operation,
      this.routes.unassignTaskInternal(taskKey, userId, sentOnce(withHeaders('If-Match', ifMatch))),
    );
    expectStatus(TASK_SERVICE, operation, answer, 204);
    return versionOf(operation, answer);
  }

  /**
   * Method addTaskLabel
   *
   * @description
   * `POST /internal/v1/tasks/{taskKey}/labels/add`, with the `If-Match` of the public request.
   * Never retried.
   *
   * @param {string} taskKey - Key of the task.
   * @param {unknown} change - The label.
   * @param {string | undefined} ifMatch - `If-Match` of the public request.
   * @returns {Promise<z.output<typeof AddTaskLabelInternalResponse>>} The task.
   */
  public addTaskLabel(
    taskKey: string,
    change: unknown,
    ifMatch: string | undefined,
  ): Promise<z.output<typeof AddTaskLabelInternalResponse>> {
    const operation = 'addTaskLabelInternal';
    return call(
      operation,
      200,
      AddTaskLabelInternalResponse,
      this.routes.addTaskLabelInternal(
        taskKey,
        toRequest(operation, AddTaskLabelInternalBody, change),
        sentOnce(withHeaders('If-Match', ifMatch)),
      ),
    );
  }

  /**
   * Method removeTaskLabel
   *
   * @description
   * `POST /internal/v1/tasks/{taskKey}/labels/remove`, with the `If-Match` of the public request.
   * Never retried.
   *
   * @param {string} taskKey - Key of the task.
   * @param {unknown} change - The label.
   * @param {string | undefined} ifMatch - `If-Match` of the public request.
   * @returns {Promise<z.output<typeof RemoveTaskLabelInternalResponse>>} The task.
   */
  public removeTaskLabel(
    taskKey: string,
    change: unknown,
    ifMatch: string | undefined,
  ): Promise<z.output<typeof RemoveTaskLabelInternalResponse>> {
    const operation = 'removeTaskLabelInternal';
    return call(
      operation,
      200,
      RemoveTaskLabelInternalResponse,
      this.routes.removeTaskLabelInternal(
        taskKey,
        toRequest(operation, RemoveTaskLabelInternalBody, change),
        sentOnce(withHeaders('If-Match', ifMatch)),
      ),
    );
  }

  /**
   * Method listTaskActivity
   *
   * @description
   * `GET /internal/v1/tasks/{taskKey}/activity`.
   *
   * @param {string} taskKey - Key of the task.
   * @param {unknown} query - Kinds, cursor and page size.
   * @returns {Promise<z.output<typeof ListTaskActivityInternalResponse>>} One page of entries.
   */
  public listTaskActivity(
    taskKey: string,
    query: unknown,
  ): Promise<z.output<typeof ListTaskActivityInternalResponse>> {
    const operation = 'listTaskActivityInternal';
    return call(
      operation,
      200,
      ListTaskActivityInternalResponse,
      this.routes.listTaskActivityInternal(
        taskKey,
        toRequest(operation, ListTaskActivityInternalQueryParams, query),
      ),
    );
  }

  /** Reads a page of work logs with the task-wide totals. */
  public listTaskTimeEntries(
    taskKey: string,
    query: unknown,
  ): Promise<z.output<typeof ListTaskTimeEntriesInternalResponse>> {
    const operation = 'listTaskTimeEntriesInternal';
    return call(
      operation,
      200,
      ListTaskTimeEntriesInternalResponse,
      this.routes.listTaskTimeEntriesInternal(
        taskKey,
        toRequest(operation, ListTaskTimeEntriesInternalQueryParams, query),
      ),
    );
  }

  /** Records one work log and verifies that the internal location names it. */
  public async createTaskTimeEntry(
    taskKey: string,
    body: unknown,
    idempotencyKey: string | undefined,
  ): Promise<z.output<typeof CreateTaskTimeEntryInternalResponse>> {
    const operation = 'createTaskTimeEntryInternal';
    const answer = await answered(
      TASK_SERVICE,
      operation,
      this.routes.createTaskTimeEntryInternal(
        taskKey,
        toRequest(operation, CreateTaskTimeEntryInternalBody, body),
        sentOnce(withHeaders('Idempotency-Key', idempotencyKey)),
      ),
    );
    const entry = expectBody(
      TASK_SERVICE,
      operation,
      answer,
      201,
      CreateTaskTimeEntryInternalResponse,
    );
    const location = `/internal/v1/tasks/${taskKey}/time-entries/${entry.id}`;
    if (entry.taskKey !== taskKey || answer.headers.get('Location') !== location) {
      throw outsideContract(
        TASK_SERVICE,
        operation,
        'a Location that does not name the time entry',
      );
    }
    return entry;
  }

  /** Reads a work log belonging to the requested task. */
  public getTaskTimeEntry(
    taskKey: string,
    timeEntryId: string,
  ): Promise<z.output<typeof GetTaskTimeEntryInternalResponse>> {
    return call(
      'getTaskTimeEntryInternal',
      200,
      GetTaskTimeEntryInternalResponse,
      this.routes.getTaskTimeEntryInternal(taskKey, timeEntryId),
    );
  }

  /** Removes a work log through the producer's author check. */
  public deleteTaskTimeEntry(taskKey: string, timeEntryId: string): Promise<void> {
    return acknowledged(
      'deleteTaskTimeEntryInternal',
      204,
      this.routes.deleteTaskTimeEntryInternal(taskKey, timeEntryId, sentOnce()),
    );
  }

  /** Reads the recorded and estimated time of a task. */
  public getTaskTimeSummary(
    taskKey: string,
  ): Promise<z.output<typeof GetTaskTimeSummaryInternalResponse>> {
    return call(
      'getTaskTimeSummaryInternal',
      200,
      GetTaskTimeSummaryInternalResponse,
      this.routes.getTaskTimeSummaryInternal(taskKey),
    );
  }

  /** Reads the producer's measured status history for a task. */
  public getTaskStatusDurations(
    taskKey: string,
  ): Promise<z.output<typeof GetTaskStatusDurationsInternalResponse>> {
    return call(
      'getTaskStatusDurationsInternal',
      200,
      GetTaskStatusDurationsInternalResponse,
      this.routes.getTaskStatusDurationsInternal(taskKey),
    );
  }

  /** Reads the visible task's approval round and task ETag. */
  public getTaskApproval(
    taskKey: string,
  ): Promise<VersionedBody<typeof GetTaskApprovalInternalResponse>> {
    return versionedBody(
      'getTaskApprovalInternal',
      GetTaskApprovalInternalResponse,
      this.routes.getTaskApprovalInternal(taskKey),
      (body) => body.taskVersion,
    );
  }

  /** Starts a task approval round with the caller's task precondition. */
  public requestTaskApproval(
    taskKey: string,
    body: unknown,
    ifMatch: string | undefined,
  ): Promise<VersionedBody<typeof RequestTaskApprovalInternalResponse>> {
    const operation = 'requestTaskApprovalInternal';
    return versionedBody(
      operation,
      RequestTaskApprovalInternalResponse,
      this.routes.requestTaskApprovalInternal(
        taskKey,
        toRequest(operation, RequestTaskApprovalInternalBody, body),
        sentOnce(withHeaders('If-Match', ifMatch)),
      ),
      (body) => body.taskVersion,
    );
  }

  /** Records the caller's decision in the specified round. */
  public voteOnTaskApproval(
    taskKey: string,
    roundId: string,
    body: unknown,
    ifMatch: string | undefined,
  ): Promise<VersionedBody<typeof VoteOnTaskApprovalInternalResponse>> {
    const operation = 'voteOnTaskApprovalInternal';
    return versionedBody(
      operation,
      VoteOnTaskApprovalInternalResponse,
      this.routes.voteOnTaskApprovalInternal(
        taskKey,
        roundId,
        toRequest(operation, VoteOnTaskApprovalInternalBody, body),
        sentOnce(withHeaders('If-Match', ifMatch)),
      ),
      (body) => body.taskVersion,
    );
  }

  /** Withdraws a vote and returns the task ETag from the producer. */
  public async withdrawTaskApprovalVote(
    taskKey: string,
    roundId: string,
    ifMatch: string | undefined,
  ): Promise<{ version: number }> {
    const operation = 'withdrawTaskApprovalVoteInternal';
    const answer = await answered(
      TASK_SERVICE,
      operation,
      this.routes.withdrawTaskApprovalVoteInternal(
        taskKey,
        roundId,
        sentOnce(withHeaders('If-Match', ifMatch)),
      ),
    );
    expectStatus(TASK_SERVICE, operation, answer, 204);
    return { version: versionOf(operation, answer) };
  }

  /** Reads the actor's onboarding state in the current organization. */
  public getOnboarding(
    userId: string,
  ): Promise<VersionedBody<typeof GetOnboardingInternalResponse>> {
    return versionedBody(
      'getOnboardingInternal',
      GetOnboardingInternalResponse,
      this.routes.getOnboardingInternal(userId),
      (body) => body.version,
    );
  }

  /** Updates the actor's wizard draft under its precondition. */
  public updateOnboarding(
    userId: string,
    body: unknown,
    ifMatch: string | undefined,
  ): Promise<VersionedBody<typeof UpdateOnboardingInternalResponse>> {
    const operation = 'updateOnboardingInternal';
    return versionedBody(
      operation,
      UpdateOnboardingInternalResponse,
      this.routes.updateOnboardingInternal(
        userId,
        toRequest(operation, UpdateOnboardingInternalBody, body),
        sentOnce(withHeaders('If-Match', ifMatch)),
      ),
      (body) => body.version,
    );
  }

  /** Updates the actor's checklist under its precondition. */
  public updateOnboardingChecklist(
    userId: string,
    body: unknown,
    ifMatch: string | undefined,
  ): Promise<VersionedBody<typeof UpdateOnboardingChecklistInternalResponse>> {
    const operation = 'updateOnboardingChecklistInternal';
    return versionedBody(
      operation,
      UpdateOnboardingChecklistInternalResponse,
      this.routes.updateOnboardingChecklistInternal(
        userId,
        toRequest(operation, UpdateOnboardingChecklistInternalBody, body),
        sentOnce(withHeaders('If-Match', ifMatch)),
      ),
      (body) => body.version,
    );
  }

  /** Completes onboarding and verifies the resulting space's location. */
  public async finishOnboarding(
    userId: string,
    body: unknown,
    ifMatch: string | undefined,
    key: string | undefined,
  ): Promise<VersionedBody<typeof FinishOnboardingInternalResponse>> {
    const operation = 'finishOnboardingInternal';
    const headers: Record<string, string> = {};
    if (ifMatch !== undefined) headers['If-Match'] = ifMatch;
    if (key !== undefined) headers['Idempotency-Key'] = key;
    const answer = await answered(
      TASK_SERVICE,
      operation,
      this.routes.finishOnboardingInternal(
        userId,
        toRequest(operation, FinishOnboardingInternalBody, body),
        sentOnce({ headers }),
      ),
    );
    const state = expectBody(
      TASK_SERVICE,
      operation,
      answer,
      201,
      FinishOnboardingInternalResponse,
    );
    const version = versionOf(operation, answer);
    if (
      state.provisioning === null ||
      answer.headers.get('Location') !== `/internal/v1/spaces/${state.provisioning.spaceId}` ||
      version !== state.version
    ) {
      throw outsideContract(TASK_SERVICE, operation, 'an inconsistent provisioning response');
    }
    return { body: state, version };
  }

  /** Lists the active fields of a visible space. */
  public listSpaceCustomFields(
    spaceId: string,
    query: unknown,
  ): Promise<z.output<typeof ListSpaceCustomFieldsInternalResponse>> {
    const operation = 'listSpaceCustomFieldsInternal';
    return call(
      operation,
      200,
      ListSpaceCustomFieldsInternalResponse,
      this.routes.listSpaceCustomFieldsInternal(
        spaceId,
        toRequest(operation, ListSpaceCustomFieldsInternalQueryParams, query),
      ),
    );
  }

  /** Creates a definition and verifies its version and retrievable location. */
  public async createSpaceCustomField(
    spaceId: string,
    body: unknown,
    key: string | undefined,
  ): Promise<VersionedField<typeof CreateSpaceCustomFieldInternalResponse>> {
    const operation = 'createSpaceCustomFieldInternal';
    const answer = await answered(
      TASK_SERVICE,
      operation,
      this.routes.createSpaceCustomFieldInternal(
        spaceId,
        toRequest(operation, CreateSpaceCustomFieldInternalBody, body),
        sentOnce(withHeaders('Idempotency-Key', key)),
      ),
    );
    const field = expectBody(
      TASK_SERVICE,
      operation,
      answer,
      201,
      CreateSpaceCustomFieldInternalResponse,
    );
    const version = versionOf(operation, answer);
    const location = `/internal/v1/spaces/${spaceId}/custom-fields/${field.id}`.toLowerCase();
    if (
      field.spaceId.toLowerCase() !== spaceId.toLowerCase() ||
      answer.headers.get('Location')?.toLowerCase() !== location ||
      version !== field.version
    ) {
      throw outsideContract(TASK_SERVICE, operation, 'an inconsistent custom field creation');
    }
    return { field, version };
  }

  /** Reads one field and its conditional write version. */
  public async getSpaceCustomField(
    spaceId: string,
    fieldId: string,
  ): Promise<VersionedField<typeof GetSpaceCustomFieldInternalResponse>> {
    const { body: field, version } = await versionedBody(
      'getSpaceCustomFieldInternal',
      GetSpaceCustomFieldInternalResponse,
      this.routes.getSpaceCustomFieldInternal(spaceId, fieldId),
      (body) => body.version,
    );
    return { field, version };
  }

  /** Applies the provided field patch under its precondition. */
  public async updateSpaceCustomField(
    spaceId: string,
    fieldId: string,
    body: unknown,
    ifMatch: string | undefined,
  ): Promise<VersionedField<typeof UpdateSpaceCustomFieldInternalResponse>> {
    const operation = 'updateSpaceCustomFieldInternal';
    const { body: field, version } = await versionedBody(
      operation,
      UpdateSpaceCustomFieldInternalResponse,
      this.routes.updateSpaceCustomFieldInternal(
        spaceId,
        fieldId,
        toRequest(operation, UpdateSpaceCustomFieldInternalBody, body),
        sentOnce(withHeaders('If-Match', ifMatch)),
      ),
      (body) => body.version,
    );
    return { field, version };
  }

  /** Removes a definition from active use. */
  public retireSpaceCustomField(
    spaceId: string,
    fieldId: string,
    ifMatch: string | undefined,
  ): Promise<void> {
    return acknowledged(
      'retireSpaceCustomFieldInternal',
      204,
      this.routes.retireSpaceCustomFieldInternal(
        spaceId,
        fieldId,
        sentOnce(withHeaders('If-Match', ifMatch)),
      ),
    );
  }

  /** Reads the fields of the space owning a visible list. */
  public listListCustomFields(
    listId: string,
    query: unknown,
  ): Promise<z.output<typeof ListListCustomFieldsInternalResponse>> {
    const operation = 'listListCustomFieldsInternal';
    return call(
      operation,
      200,
      ListListCustomFieldsInternalResponse,
      this.routes.listListCustomFieldsInternal(
        listId,
        toRequest(operation, ListListCustomFieldsInternalQueryParams, query),
      ),
    );
  }

  /**
   * Method listLabels
   *
   * @description
   * `GET /internal/v1/labels`.
   *
   * @param {unknown} query - Search, cursor and page size.
   * @returns {Promise<z.output<typeof ListLabelsInternalResponse>>} One page of labels.
   */
  public listLabels(query: unknown): Promise<z.output<typeof ListLabelsInternalResponse>> {
    const operation = 'listLabelsInternal';
    return call(
      operation,
      200,
      ListLabelsInternalResponse,
      this.routes.listLabelsInternal(toRequest(operation, ListLabelsInternalQueryParams, query)),
    );
  }

  /**
   * Method listMyTasks
   *
   * @description
   * `GET /internal/v1/users/{userId}/tasks`.
   *
   * @param {string} userId - Id of the user of the context, as the introspection returned it.
   * @param {unknown} query - State, cursor and page size.
   * @returns {Promise<z.output<typeof ListMyTasksInternalResponse>>} One page of the tasks of the
   * user.
   */
  public listMyTasks(
    userId: string,
    query: unknown,
  ): Promise<z.output<typeof ListMyTasksInternalResponse>> {
    const operation = 'listMyTasksInternal';
    return call(
      operation,
      200,
      ListMyTasksInternalResponse,
      this.routes.listMyTasksInternal(
        userId,
        toRequest(operation, ListMyTasksInternalQueryParams, query),
      ),
    );
  }

  /**
   * Method getHome
   *
   * @description
   * `GET /internal/v1/users/{userId}/home`, with the `today` of the caller.
   *
   * @param {string} userId - Id of the user of the context, as the introspection returned it.
   * @param {unknown} query - `today`.
   * @returns {Promise<z.output<typeof GetHomeInternalResponse>>} The task part of "Accueil".
   */
  public getHome(
    userId: string,
    query: unknown,
  ): Promise<z.output<typeof GetHomeInternalResponse>> {
    const operation = 'getHomeInternal';
    return call(
      operation,
      200,
      GetHomeInternalResponse,
      this.routes.getHomeInternal(userId, toRequest(operation, GetHomeInternalQueryParams, query)),
    );
  }

  /**
   * Method listSpaceGrants
   *
   * @description
   * `GET /internal/v1/spaces/{spaceId}/grants`.
   *
   * @param {string} spaceId - Id of the space.
   * @param {unknown} query - Cursor and page size.
   * @returns {Promise<z.output<typeof ListSpaceGrantsInternalResponse>>} One page of grants.
   */
  public listSpaceGrants(
    spaceId: string,
    query: unknown,
  ): Promise<z.output<typeof ListSpaceGrantsInternalResponse>> {
    const operation = 'listSpaceGrantsInternal';
    return call(
      operation,
      200,
      ListSpaceGrantsInternalResponse,
      this.routes.listSpaceGrantsInternal(
        spaceId,
        toRequest(operation, ListSpaceGrantsInternalQueryParams, query),
      ),
    );
  }

  /**
   * Method setSpaceGrant
   *
   * @description
   * `PUT /internal/v1/spaces/{spaceId}/grants/{userId}`, with the `If-Match` of the public
   * request: `200` with the grant and the `ETag` of the space. Never retried, with or without
   * `If-Match`: a repeat after a lost answer would give again a grant another manager revoked in
   * between.
   *
   * @param {string} spaceId - Id of the space.
   * @param {string} userId - Account given the role.
   * @param {unknown} change - The role.
   * @param {string | undefined} ifMatch - `If-Match` of the public request, version of the space.
   * @returns {Promise<VersionedGrant>} The grant and the version of the space.
   * @throws {ProblemException} 503 `upstream.failed` without a strong `ETag`.
   */
  public async setSpaceGrant(
    spaceId: string,
    userId: string,
    change: unknown,
    ifMatch: string | undefined,
  ): Promise<VersionedGrant> {
    const operation = 'setSpaceGrantInternal';
    const answer: GeneratedAnswer = await answered(
      TASK_SERVICE,
      operation,
      this.routes.setSpaceGrantInternal(
        spaceId,
        userId,
        toRequest(operation, SetSpaceGrantInternalBody, change),
        sentOnce(withHeaders('If-Match', ifMatch)),
      ),
    );
    const grant: z.output<typeof SetSpaceGrantInternalResponse> = expectBody(
      TASK_SERVICE,
      operation,
      answer,
      200,
      SetSpaceGrantInternalResponse,
    );
    return { grant, version: versionOf(operation, answer) };
  }

  /**
   * Method removeSpaceGrant
   *
   * @description
   * `DELETE /internal/v1/spaces/{spaceId}/grants/{userId}`, with the `If-Match` of the public
   * request: `204` with the `ETag` of the space. Never retried, with or without `If-Match`: a
   * repeat after a lost answer would revoke a grant another manager gave in between.
   *
   * @param {string} spaceId - Id of the space.
   * @param {string} userId - Account whose grant is removed.
   * @param {string | undefined} ifMatch - `If-Match` of the public request, version of the space.
   * @returns {Promise<number>} The version of the space after the change.
   * @throws {ProblemException} 503 `upstream.failed` without a strong `ETag`.
   */
  public async removeSpaceGrant(
    spaceId: string,
    userId: string,
    ifMatch: string | undefined,
  ): Promise<number> {
    const operation = 'removeSpaceGrantInternal';
    const answer: GeneratedAnswer = await answered(
      TASK_SERVICE,
      operation,
      this.routes.removeSpaceGrantInternal(
        spaceId,
        userId,
        sentOnce(withHeaders('If-Match', ifMatch)),
      ),
    );
    expectStatus(TASK_SERVICE, operation, answer, 204);
    return versionOf(operation, answer);
  }

  /**
   * Method listListGrants
   *
   * @description
   * `GET /internal/v1/lists/{listId}/grants`.
   *
   * @param {string} listId - Id of the list.
   * @param {unknown} query - Cursor and page size.
   * @returns {Promise<z.output<typeof ListListGrantsInternalResponse>>} One page of grants.
   */
  public listListGrants(
    listId: string,
    query: unknown,
  ): Promise<z.output<typeof ListListGrantsInternalResponse>> {
    const operation = 'listListGrantsInternal';
    return call(
      operation,
      200,
      ListListGrantsInternalResponse,
      this.routes.listListGrantsInternal(
        listId,
        toRequest(operation, ListListGrantsInternalQueryParams, query),
      ),
    );
  }

  /**
   * Method setListGrant
   *
   * @description
   * `PUT /internal/v1/lists/{listId}/grants/{userId}`, with the `If-Match` of the public request:
   * `200` with the grant and the `ETag` of the list. Never retried, with or without `If-Match`: a
   * repeat after a lost answer would give again a grant another manager revoked in between.
   *
   * @param {string} listId - Id of the list.
   * @param {string} userId - Account given the role.
   * @param {unknown} change - The role.
   * @param {string | undefined} ifMatch - `If-Match` of the public request, version of the list.
   * @returns {Promise<VersionedGrant>} The grant and the version of the list.
   * @throws {ProblemException} 503 `upstream.failed` without a strong `ETag`.
   */
  public async setListGrant(
    listId: string,
    userId: string,
    change: unknown,
    ifMatch: string | undefined,
  ): Promise<VersionedGrant> {
    const operation = 'setListGrantInternal';
    const answer: GeneratedAnswer = await answered(
      TASK_SERVICE,
      operation,
      this.routes.setListGrantInternal(
        listId,
        userId,
        toRequest(operation, SetListGrantInternalBody, change),
        sentOnce(withHeaders('If-Match', ifMatch)),
      ),
    );
    const grant: z.output<typeof SetListGrantInternalResponse> = expectBody(
      TASK_SERVICE,
      operation,
      answer,
      200,
      SetListGrantInternalResponse,
    );
    return { grant, version: versionOf(operation, answer) };
  }

  /**
   * Method removeListGrant
   *
   * @description
   * `DELETE /internal/v1/lists/{listId}/grants/{userId}`, with the `If-Match` of the public
   * request: `204` with the `ETag` of the list. Never retried, with or without `If-Match`: a
   * repeat after a lost answer would revoke a grant another manager gave in between.
   *
   * @param {string} listId - Id of the list.
   * @param {string} userId - Account whose grant is removed.
   * @param {string | undefined} ifMatch - `If-Match` of the public request, version of the list.
   * @returns {Promise<number>} The version of the list after the change.
   * @throws {ProblemException} 503 `upstream.failed` without a strong `ETag`.
   */
  public async removeListGrant(
    listId: string,
    userId: string,
    ifMatch: string | undefined,
  ): Promise<number> {
    const operation = 'removeListGrantInternal';
    const answer: GeneratedAnswer = await answered(
      TASK_SERVICE,
      operation,
      this.routes.removeListGrantInternal(
        listId,
        userId,
        sentOnce(withHeaders('If-Match', ifMatch)),
      ),
    );
    expectStatus(TASK_SERVICE, operation, answer, 204);
    return versionOf(operation, answer);
  }

  /**
   * Method createAccessRequest
   *
   * @description
   * `POST /internal/v1/access-requests`: `202` with no body, whether the request was stored or
   * not. Never retried.
   *
   * @param {unknown} creation - The one target and the message.
   * @returns {Promise<void>} Once task-service took the request.
   */
  public createAccessRequest(creation: unknown): Promise<void> {
    const operation = 'createAccessRequestInternal';
    return acknowledged(
      operation,
      202,
      this.routes.createAccessRequestInternal(
        toRequest(operation, CreateAccessRequestInternalBody, creation),
        sentOnce(),
      ),
    );
  }

  /**
   * Method listAccessRequests
   *
   * @description
   * `GET /internal/v1/access-requests`: the pending requests the actor may answer.
   *
   * @param {unknown} query - Space or list, cursor and page size.
   * @returns {Promise<z.output<typeof ListAccessRequestsInternalResponse>>} One page of requests.
   */
  public listAccessRequests(
    query: unknown,
  ): Promise<z.output<typeof ListAccessRequestsInternalResponse>> {
    const operation = 'listAccessRequestsInternal';
    return call(
      operation,
      200,
      ListAccessRequestsInternalResponse,
      this.routes.listAccessRequestsInternal(
        toRequest(operation, ListAccessRequestsInternalQueryParams, query),
      ),
    );
  }

  /**
   * Method approveAccessRequest
   *
   * @description
   * `POST /internal/v1/access-requests/{accessRequestId}/approval`. Never retried.
   *
   * @param {string} accessRequestId - Id of the request.
   * @param {unknown} approval - The role to give.
   * @returns {Promise<z.output<typeof ApproveAccessRequestInternalResponse>>} The request,
   * approved.
   */
  public approveAccessRequest(
    accessRequestId: string,
    approval: unknown,
  ): Promise<z.output<typeof ApproveAccessRequestInternalResponse>> {
    const operation = 'approveAccessRequestInternal';
    return call(
      operation,
      200,
      ApproveAccessRequestInternalResponse,
      this.routes.approveAccessRequestInternal(
        accessRequestId,
        toRequest(operation, ApproveAccessRequestInternalBody, approval),
        sentOnce(),
      ),
    );
  }

  /**
   * Method refuseAccessRequest
   *
   * @description
   * `POST /internal/v1/access-requests/{accessRequestId}/refusal`. Never retried.
   *
   * @param {string} accessRequestId - Id of the request.
   * @param {unknown} refusal - The empty body (`EmptyRequest`).
   * @returns {Promise<z.output<typeof RefuseAccessRequestInternalResponse>>} The request,
   * refused.
   */
  public refuseAccessRequest(
    accessRequestId: string,
    refusal: unknown,
  ): Promise<z.output<typeof RefuseAccessRequestInternalResponse>> {
    const operation = 'refuseAccessRequestInternal';
    return call(
      operation,
      200,
      RefuseAccessRequestInternalResponse,
      this.routes.refuseAccessRequestInternal(
        accessRequestId,
        toRequest(operation, RefuseAccessRequestInternalBody, refusal),
        sentOnce(),
      ),
    );
  }

  /**
   * Method archiveList
   *
   * @description
   * `POST /internal/v1/lists/{listId}/archive`, with the `If-Match` of the public request. Never
   * retried.
   *
   * @param {string} listId - Id of the list.
   * @param {unknown} body - The empty body (`EmptyRequest`).
   * @param {string | undefined} ifMatch - `If-Match` of the public request.
   * @returns {Promise<z.output<typeof ArchiveListInternalResponse>>} The list, archived.
   */
  public archiveList(
    listId: string,
    body: unknown,
    ifMatch: string | undefined,
  ): Promise<z.output<typeof ArchiveListInternalResponse>> {
    const operation = 'archiveListInternal';
    return call(
      operation,
      200,
      ArchiveListInternalResponse,
      this.routes.archiveListInternal(
        listId,
        toRequest(operation, ArchiveListInternalBody, body),
        sentOnce(withHeaders('If-Match', ifMatch)),
      ),
    );
  }

  /**
   * Method unarchiveList
   *
   * @description
   * `POST /internal/v1/lists/{listId}/unarchive`, with the `If-Match` of the public request.
   * Never retried.
   *
   * @param {string} listId - Id of the list.
   * @param {unknown} body - The empty body (`EmptyRequest`).
   * @param {string | undefined} ifMatch - `If-Match` of the public request.
   * @returns {Promise<z.output<typeof UnarchiveListInternalResponse>>} The list, back in its
   * space.
   */
  public unarchiveList(
    listId: string,
    body: unknown,
    ifMatch: string | undefined,
  ): Promise<z.output<typeof UnarchiveListInternalResponse>> {
    const operation = 'unarchiveListInternal';
    return call(
      operation,
      200,
      UnarchiveListInternalResponse,
      this.routes.unarchiveListInternal(
        listId,
        toRequest(operation, UnarchiveListInternalBody, body),
        sentOnce(withHeaders('If-Match', ifMatch)),
      ),
    );
  }

  /**
   * Method archiveTask
   *
   * @description
   * `POST /internal/v1/tasks/{taskKey}/archive`, with the `If-Match` of the public request: the
   * task and its subtasks at every level. Never retried.
   *
   * @param {string} taskKey - Key of the task.
   * @param {unknown} body - The empty body (`EmptyRequest`).
   * @param {string | undefined} ifMatch - `If-Match` of the public request.
   * @returns {Promise<z.output<typeof ArchiveTaskInternalResponse>>} The task, archived.
   */
  public archiveTask(
    taskKey: string,
    body: unknown,
    ifMatch: string | undefined,
  ): Promise<z.output<typeof ArchiveTaskInternalResponse>> {
    const operation = 'archiveTaskInternal';
    return call(
      operation,
      200,
      ArchiveTaskInternalResponse,
      this.routes.archiveTaskInternal(
        taskKey,
        toRequest(operation, ArchiveTaskInternalBody, body),
        sentOnce(withHeaders('If-Match', ifMatch)),
      ),
    );
  }

  /**
   * Method unarchiveTask
   *
   * @description
   * `POST /internal/v1/tasks/{taskKey}/unarchive`, with the `If-Match` of the public request:
   * the archive the task belongs to, from its root. Never retried.
   *
   * @param {string} taskKey - Key of the task.
   * @param {unknown} body - The empty body (`EmptyRequest`).
   * @param {string | undefined} ifMatch - `If-Match` of the public request.
   * @returns {Promise<z.output<typeof UnarchiveTaskInternalResponse>>} The root of the archive,
   * back in its list.
   */
  public unarchiveTask(
    taskKey: string,
    body: unknown,
    ifMatch: string | undefined,
  ): Promise<z.output<typeof UnarchiveTaskInternalResponse>> {
    const operation = 'unarchiveTaskInternal';
    return call(
      operation,
      200,
      UnarchiveTaskInternalResponse,
      this.routes.unarchiveTaskInternal(
        taskKey,
        toRequest(operation, UnarchiveTaskInternalBody, body),
        sentOnce(withHeaders('If-Match', ifMatch)),
      ),
    );
  }

  /**
   * Method listArchivedLists
   *
   * @description
   * `GET /internal/v1/archives/lists`.
   *
   * @param {unknown} query - Cursor and page size.
   * @returns {Promise<z.output<typeof ListArchivedListsInternalResponse>>} One page of archived
   * lists.
   */
  public listArchivedLists(
    query: unknown,
  ): Promise<z.output<typeof ListArchivedListsInternalResponse>> {
    const operation = 'listArchivedListsInternal';
    return call(
      operation,
      200,
      ListArchivedListsInternalResponse,
      this.routes.listArchivedListsInternal(
        toRequest(operation, ListArchivedListsInternalQueryParams, query),
      ),
    );
  }

  /**
   * Method listArchivedTasks
   *
   * @description
   * `GET /internal/v1/archives/tasks`: the roots of the archived subtrees.
   *
   * @param {unknown} query - Cursor and page size.
   * @returns {Promise<z.output<typeof ListArchivedTasksInternalResponse>>} One page of archived
   * tasks.
   */
  public listArchivedTasks(
    query: unknown,
  ): Promise<z.output<typeof ListArchivedTasksInternalResponse>> {
    const operation = 'listArchivedTasksInternal';
    return call(
      operation,
      200,
      ListArchivedTasksInternalResponse,
      this.routes.listArchivedTasksInternal(
        toRequest(operation, ListArchivedTasksInternalQueryParams, query),
      ),
    );
  }

  /**
   * Method trashTask
   *
   * @description
   * `POST /internal/v1/tasks/{taskKey}/trash`, with the `If-Match` of the public request: the task
   * and its subtasks at every level, as one entry. Never retried.
   *
   * @param {string} taskKey - Key of the task.
   * @param {unknown} body - The empty body (`EmptyRequest`).
   * @param {string | undefined} ifMatch - `If-Match` of the public request.
   * @returns {Promise<z.output<typeof TrashTaskInternalResponse>>} The trash entry.
   */
  public trashTask(
    taskKey: string,
    body: unknown,
    ifMatch: string | undefined,
  ): Promise<z.output<typeof TrashTaskInternalResponse>> {
    const operation = 'trashTaskInternal';
    return call(
      operation,
      200,
      TrashTaskInternalResponse,
      this.routes.trashTaskInternal(
        taskKey,
        toRequest(operation, TrashTaskInternalBody, body),
        sentOnce(withHeaders('If-Match', ifMatch)),
      ),
    );
  }

  /**
   * Method listTrash
   *
   * @description
   * `GET /internal/v1/trash/entries`: the entries the actor may restore.
   *
   * @param {unknown} query - Cursor and page size.
   * @returns {Promise<z.output<typeof ListTrashInternalResponse>>} One page of trash entries.
   */
  public listTrash(query: unknown): Promise<z.output<typeof ListTrashInternalResponse>> {
    const operation = 'listTrashInternal';
    return call(
      operation,
      200,
      ListTrashInternalResponse,
      this.routes.listTrashInternal(toRequest(operation, ListTrashInternalQueryParams, query)),
    );
  }

  /**
   * Method purgeTrashEntry
   *
   * @description
   * `DELETE /internal/v1/trash/entries/{entryId}`: `204`. The contract declares no `If-Match`.
   * Never retried, like every change but a creation with an `Idempotency-Key`.
   *
   * @param {string} entryId - Id of the entry.
   * @returns {Promise<void>} Once the entry is erased.
   */
  public purgeTrashEntry(entryId: string): Promise<void> {
    return acknowledged(
      'purgeTrashEntryInternal',
      204,
      this.routes.purgeTrashEntryInternal(entryId, sentOnce()),
    );
  }

  /**
   * Method restoreTrashEntry
   *
   * @description
   * `POST /internal/v1/trash/entries/{entryId}/restore`. Never retried.
   *
   * @param {string} entryId - Id of the entry.
   * @param {unknown} body - The empty body (`EmptyRequest`).
   * @returns {Promise<z.output<typeof RestoreTrashEntryInternalResponse>>} The root of the entry,
   * back in its list, and what came back with it.
   */
  public restoreTrashEntry(
    entryId: string,
    body: unknown,
    query: unknown,
  ): Promise<z.output<typeof RestoreTrashEntryInternalResponse>> {
    const operation = 'restoreTrashEntryInternal';
    return call(
      operation,
      200,
      RestoreTrashEntryInternalResponse,
      this.routes.restoreTrashEntryInternal(
        entryId,
        toRequest(operation, RestoreTrashEntryInternalBody, body),
        toRequest(operation, RestoreTrashEntryInternalQueryParams, query),
        sentOnce(),
      ),
    );
  }

  /**
   * Method emptyTrash
   *
   * @description
   * `POST /internal/v1/trash/empty`: `202` with the count of the entries handed to the purge job.
   * Never retried.
   *
   * @param {unknown} body - The empty body (`EmptyRequest`).
   * @returns {Promise<z.output<typeof EmptyTrashInternalResponse>>} The count of the entries.
   */
  public emptyTrash(body: unknown): Promise<z.output<typeof EmptyTrashInternalResponse>> {
    const operation = 'emptyTrashInternal';
    return call(
      operation,
      202,
      EmptyTrashInternalResponse,
      this.routes.emptyTrashInternal(
        toRequest(operation, EmptyTrashInternalBody, body),
        sentOnce(),
      ),
    );
  }
  // #endregion
}

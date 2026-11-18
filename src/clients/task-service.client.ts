import {
  AddChecklistItemInternalBody,
  AddChecklistItemInternalResponse,
  AddTaskLabelInternalBody,
  AddTaskLabelInternalResponse,
  AssignTaskInternalResponse,
  CountTaskGroupsInternalQueryParams,
  CountTaskGroupsInternalResponse,
  CreateListInternalBody,
  CreateListInternalResponse,
  CreateSpaceInternalBody,
  CreateSpaceInternalResponse,
  CreateSubtaskInternalBody,
  CreateSubtaskInternalResponse,
  CreateTaskInternalBody,
  CreateTaskInternalResponse,
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
  ListLabelsInternalQueryParams,
  ListLabelsInternalResponse,
  ListListActivityInternalQueryParams,
  ListListActivityInternalResponse,
  ListListsInternalQueryParams,
  ListListsInternalResponse,
  ListMyTasksInternalQueryParams,
  ListMyTasksInternalResponse,
  ListSpacesInternalQueryParams,
  ListSpacesInternalResponse,
  ListSubtasksInternalQueryParams,
  ListSubtasksInternalResponse,
  ListTaskActivityInternalQueryParams,
  ListTaskActivityInternalResponse,
  ListTasksInternalQueryParams,
  ListTasksInternalResponse,
  RemoveTaskLabelInternalBody,
  RemoveTaskLabelInternalResponse,
  UpdateChecklistItemInternalBody,
  UpdateChecklistItemInternalResponse,
  UpdateListInternalBody,
  UpdateListInternalResponse,
  UpdateSpaceInternalBody,
  UpdateSpaceInternalResponse,
  UpdateTaskInternalBody,
  UpdateTaskInternalResponse,
} from '@cadenway/contracts/validators/internal/task-service';
import type { InternalHttpClient, InternalRequestInit } from '@cadenway/nest-common';
import type { z } from 'zod';

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
 * an unassignment and the `Location` of a checklist item are read from them.
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
 * A strong entity tag as task-service sends it: the version of the task between quotes.
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
 * Class TaskServiceClient
 *
 * @description
 * Outgoing adapter of task-service: the functions generated from
 * `openapi/internal/task-service.yaml`, called through one `InternalHttpClient` of
 * `@cadenway/nest-common`, behind the ports of the space, list and task routes.
 *
 * - Every call carries an internal token signed by the gateway with `aud: task-service`, for the
 *   user and organization of the current organization context. task-service decides who sees
 *   what and answers what the actor does not see `404`.
 * - Every query and body is checked against the internal contract before it is sent, and every
 *   success after it is answered; a mismatching answer is `503 upstream.failed`.
 * - The internal HTTP client gives each call the time left to the request (2 seconds at most), one
 *   retry after a connection error or a `503` for an idempotent call (`GET`, a creation with an
 *   `Idempotency-Key`, the `PUT` and `DELETE` of an assignee without `If-Match`), and the circuit
 *   breaker of task-service.
 * - `If-Match` and `Idempotency-Key` are relayed unchanged; task-service checks the version and
 *   replays a creation.
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
  public constructor(http: InternalHttpClient) {
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
   * `PATCH /internal/v1/spaces/{spaceId}`, with the `If-Match` of the public request.
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
        withHeaders('If-Match', ifMatch),
      ),
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
   * `PATCH /internal/v1/lists/{listId}`, with the `If-Match` of the public request.
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
        withHeaders('If-Match', ifMatch),
      ),
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
  public getTask(taskKey: string): Promise<z.output<typeof GetTaskInternalResponse>> {
    return call(
      'getTaskInternal',
      200,
      GetTaskInternalResponse,
      this.routes.getTaskInternal(taskKey),
    );
  }

  /**
   * Method updateTask
   *
   * @description
   * `PATCH /internal/v1/tasks/{taskKey}`, with the `If-Match` of the public request.
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
        withHeaders('If-Match', ifMatch),
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
   * of the public request.
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
        withHeaders('If-Match', ifMatch),
      ),
    );
  }

  /**
   * Method assignTask
   *
   * @description
   * `PUT /internal/v1/tasks/{taskKey}/assignees/{userId}`, with the `If-Match` of the public
   * request.
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
        withHeaders('If-Match', ifMatch),
      ),
    );
  }

  /**
   * Method unassignTask
   *
   * @description
   * `DELETE /internal/v1/tasks/{taskKey}/assignees/{userId}`, with the `If-Match` of the public
   * request: `204` with the `ETag` of the task.
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
      this.routes.unassignTaskInternal(taskKey, userId, withHeaders('If-Match', ifMatch)),
    );
    expectStatus(TASK_SERVICE, operation, answer, 204);
    const version: string | undefined = ETAG.exec(answer.headers.get('ETag') ?? '')?.[1];
    if (version === undefined) {
      throw outsideContract(TASK_SERVICE, operation, 'no strong ETag');
    }
    return Number(version);
  }

  /**
   * Method addTaskLabel
   *
   * @description
   * `POST /internal/v1/tasks/{taskKey}/labels/add`, with the `If-Match` of the public request.
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
        withHeaders('If-Match', ifMatch),
      ),
    );
  }

  /**
   * Method removeTaskLabel
   *
   * @description
   * `POST /internal/v1/tasks/{taskKey}/labels/remove`, with the `If-Match` of the public request.
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
        withHeaders('If-Match', ifMatch),
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
  // #endregion
}

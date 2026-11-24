import {
  AddChecklistItemBody,
  AddChecklistItemHeader,
  AddChecklistItemParams,
  AddChecklistItemResponse,
  AddTaskLabelBody,
  AddTaskLabelParams,
  AddTaskLabelResponse,
  AssignTaskBody,
  AssignTaskParams,
  AssignTaskResponse,
  CountTaskGroupsParams,
  CountTaskGroupsQueryParams,
  CountTaskGroupsResponse,
  CreateSubtaskBody,
  CreateSubtaskHeader,
  CreateSubtaskParams,
  CreateSubtaskResponse,
  CreateTaskBody,
  CreateTaskHeader,
  CreateTaskParams,
  CreateTaskResponse,
  GetTaskDetailParams,
  GetTaskDetailResponse,
  GetTaskParams,
  GetTaskResponse,
  ListSubtasksParams,
  ListSubtasksQueryParams,
  ListSubtasksResponse,
  ListTaskActivityParams,
  ListTaskActivityQueryParams,
  ListTaskActivityResponse,
  ListTasksParams,
  ListTasksQueryParams,
  ListTasksResponse,
  QueryCountTaskGroupsBody,
  QueryListTasksBody,
  RemoveTaskLabelBody,
  RemoveTaskLabelParams,
  RemoveTaskLabelResponse,
  UnassignTaskParams,
  UpdateChecklistItemBody,
  UpdateChecklistItemParams,
  UpdateChecklistItemResponse,
  UpdateTaskBody,
  UpdateTaskParams,
  UpdateTaskResponse,
} from '@cadenway/contracts/validators/public/tasks';
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
  Put,
  Query,
  QueryMethod,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';

import { conformBody } from '../../../../../../problems/upstream-answer.js';
import {
  relayProblems,
  type AcceptedProblems,
} from '../../../../../../problems/upstream-problem.js';
import { RequiredBody } from '../../../../../../presentation/http/mappers/request-body.mapper.js';
import { toQueryList } from '../../../../../../presentation/http/mappers/query-parameters.mapper.js';
import {
  IfMatchHeader,
  toRequestHeader,
} from '../../../../../../presentation/http/mappers/request-headers.mapper.js';
import { CredentialGuard } from '../../../../../auth/public/credential/credential-guard.js';
import { RateLimitGuard } from '../../../../../rate-limit/public/requests/rate-limit-guard.js';
import type { TaskDetail } from '../../../../application/models/details/task-detail.model.js';
import type { AddedChecklistItem } from '../../../../application/models/checklist/added-checklist-item.model.js';
import { ListTasks } from '../../../../application/use-cases/queries/tasks/list-tasks/list-tasks.use-case.js';
import { CreateTask } from '../../../../application/use-cases/commands/tasks/create-task/create-task.use-case.js';
import { CountTaskGroups } from '../../../../application/use-cases/queries/tasks/count-task-groups/count-task-groups.use-case.js';
import { GetTask } from '../../../../application/use-cases/queries/tasks/get-task/get-task.use-case.js';
import { UpdateTask } from '../../../../application/use-cases/commands/tasks/update-task/update-task.use-case.js';
import { GetTaskDetail } from '../../../../application/use-cases/queries/details/get-task-detail/get-task-detail.use-case.js';
import { ListSubtasks } from '../../../../application/use-cases/queries/subtasks/list-subtasks/list-subtasks.use-case.js';
import { CreateSubtask } from '../../../../application/use-cases/commands/subtasks/create-subtask/create-subtask.use-case.js';
import { AddChecklistItem } from '../../../../application/use-cases/commands/checklist/add-checklist-item/add-checklist-item.use-case.js';
import { UpdateChecklistItem } from '../../../../application/use-cases/commands/checklist/update-checklist-item/update-checklist-item.use-case.js';
import { AssignTask } from '../../../../application/use-cases/commands/assignees/assign-task/assign-task.use-case.js';
import { UnassignTask } from '../../../../application/use-cases/commands/assignees/unassign-task/unassign-task.use-case.js';
import { AddTaskLabel } from '../../../../application/use-cases/commands/labels/add-task-label/add-task-label.use-case.js';
import { RemoveTaskLabel } from '../../../../application/use-cases/commands/labels/remove-task-label/remove-task-label.use-case.js';
import { ListTaskActivity } from '../../../../application/use-cases/queries/activity/list-task-activity/list-task-activity.use-case.js';

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
 * Constant LIST_TASKS_PROBLEMS
 *
 * @description
 * Client errors of task-service that `GET /v1/lists/{listId}/tasks` answers as they
 * are: the codes its public operation declares. Any other is `503 upstream.failed`.
 *
 * @type {AcceptedProblems}
 */
const LIST_TASKS_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  404: ['list.not-found', 'organization.not-found'],
};

/**
 * Constant LIST_TASKS_QUERY
 *
 * @description
 * The query of `GET /v1/lists/{listId}/tasks` as the contract validates it, with `status`, `priority`, `assignee`, `label` split on
 * their commas first (`style: form, explode: false`).
 *
 * @type {z.ZodType}
 */
const LIST_TASKS_QUERY = ListTasksQueryParams.extend({
  status: z.preprocess(toQueryList, ListTasksQueryParams.shape.status),
  priority: z.preprocess(toQueryList, ListTasksQueryParams.shape.priority),
  assignee: z.preprocess(toQueryList, ListTasksQueryParams.shape.assignee),
  label: z.preprocess(toQueryList, ListTasksQueryParams.shape.label),
});

/**
 * Constant CREATE_TASK_PROBLEMS
 *
 * @description
 * Client errors of task-service that `POST /v1/lists/{listId}/tasks` answers as they
 * are: the codes its public operation declares. Any other is `503 upstream.failed`.
 *
 * @type {AcceptedProblems}
 */
const CREATE_TASK_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  403: ['access.role-insufficient'],
  404: ['list.not-found', 'organization.not-found'],
  409: ['idempotency.request-in-progress'],
  422: [
    'task.status-hidden',
    'task.cancel-reason-required',
    'task.cancel-reason-unexpected',
    'task.assignee-invalid',
    'task.start-date-invalid',
    'idempotency.key-reused',
    'mention.recipient-invalid',
    'milestone.status-invalid',
    'milestone.dates-invalid',
  ],
};

/**
 * Constant COUNT_TASK_GROUPS_PROBLEMS
 *
 * @description
 * Client errors of task-service that `GET /v1/lists/{listId}/task-groups` answers as they
 * are: the codes its public operation declares. Any other is `503 upstream.failed`.
 *
 * @type {AcceptedProblems}
 */
const COUNT_TASK_GROUPS_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  404: ['list.not-found', 'organization.not-found'],
};

/**
 * Constant COUNT_TASK_GROUPS_QUERY
 *
 * @description
 * The query of `GET /v1/lists/{listId}/task-groups` as the contract validates it, with `status`, `priority`, `assignee`, `label` split on
 * their commas first (`style: form, explode: false`).
 *
 * @type {z.ZodType}
 */
const COUNT_TASK_GROUPS_QUERY = CountTaskGroupsQueryParams.extend({
  status: z.preprocess(toQueryList, CountTaskGroupsQueryParams.shape.status),
  priority: z.preprocess(toQueryList, CountTaskGroupsQueryParams.shape.priority),
  assignee: z.preprocess(toQueryList, CountTaskGroupsQueryParams.shape.assignee),
  label: z.preprocess(toQueryList, CountTaskGroupsQueryParams.shape.label),
});

/**
 * Constant GET_TASK_PROBLEMS
 *
 * @description
 * Client errors of task-service that `GET /v1/tasks/{taskKey}` answers as they
 * are: the codes its public operation declares. Any other is `503 upstream.failed`.
 *
 * @type {AcceptedProblems}
 */
const GET_TASK_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  404: ['task.not-found', 'task.trashed', 'organization.not-found'],
};

/**
 * Constant UPDATE_TASK_PROBLEMS
 *
 * @description
 * Client errors of task-service that `PATCH /v1/tasks/{taskKey}` answers as they
 * are: the codes its public operation declares. Any other is `503 upstream.failed`.
 *
 * @type {AcceptedProblems}
 */
const UPDATE_TASK_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  403: ['access.role-insufficient'],
  404: ['task.not-found', 'task.trashed', 'organization.not-found'],
  409: ['task.archived', 'recurrence.already-spawned'],
  412: ['request.version-mismatch'],
  422: [
    'task.status-hidden',
    'task.cancel-reason-required',
    'task.cancel-reason-unexpected',
    'task.start-date-invalid',
    'task.list-invalid',
    'task.parent-invalid',
    'task.subtask-depth-exceeded',
    'task.subtask-limit-reached',
    'mention.recipient-invalid',
    'milestone.status-invalid',
    'milestone.dates-invalid',
    'recurrence.date-out-of-range',
    'custom-field.value-invalid',
  ],
};

/**
 * Constant GET_TASK_DETAIL_PROBLEMS
 *
 * @description
 * Client errors of task-service that `GET /v1/tasks/{taskKey}/detail` answers as they
 * are: the codes its public operation declares. Any other is `503 upstream.failed`.
 *
 * @type {AcceptedProblems}
 */
const GET_TASK_DETAIL_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  404: ['task.not-found', 'task.trashed', 'organization.not-found'],
};

/**
 * Constant LIST_SUBTASKS_PROBLEMS
 *
 * @description
 * Client errors of task-service that `GET /v1/tasks/{taskKey}/subtasks` answers as they
 * are: the codes its public operation declares. Any other is `503 upstream.failed`.
 *
 * @type {AcceptedProblems}
 */
const LIST_SUBTASKS_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  404: ['task.not-found', 'task.trashed', 'organization.not-found'],
};

/**
 * Constant CREATE_SUBTASK_PROBLEMS
 *
 * @description
 * Client errors of task-service that `POST /v1/tasks/{taskKey}/subtasks` answers as they
 * are: the codes its public operation declares. Any other is `503 upstream.failed`.
 *
 * @type {AcceptedProblems}
 */
const CREATE_SUBTASK_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  403: ['access.role-insufficient'],
  404: ['task.not-found', 'task.trashed', 'organization.not-found'],
  409: ['task.archived', 'idempotency.request-in-progress'],
  422: [
    'task.subtask-depth-exceeded',
    'task.subtask-limit-reached',
    'task.status-hidden',
    'task.cancel-reason-required',
    'task.cancel-reason-unexpected',
    'task.assignee-invalid',
    'task.start-date-invalid',
    'idempotency.key-reused',
  ],
};

/**
 * Constant ADD_CHECKLIST_ITEM_PROBLEMS
 *
 * @description
 * Client errors of task-service that `POST /v1/tasks/{taskKey}/checklist-items` answers as they
 * are: the codes its public operation declares. Any other is `503 upstream.failed`.
 *
 * @type {AcceptedProblems}
 */
const ADD_CHECKLIST_ITEM_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  403: ['access.role-insufficient'],
  404: ['task.not-found', 'task.trashed', 'organization.not-found'],
  409: ['task.archived', 'idempotency.request-in-progress'],
  422: ['task.checklist-limit-reached', 'idempotency.key-reused'],
};

/**
 * Constant UPDATE_CHECKLIST_ITEM_PROBLEMS
 *
 * @description
 * Client errors of task-service that `PATCH /v1/tasks/{taskKey}/checklist-items/{checklistItemId}` answers as they
 * are: the codes its public operation declares. Any other is `503 upstream.failed`.
 *
 * @type {AcceptedProblems}
 */
const UPDATE_CHECKLIST_ITEM_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  403: ['access.role-insufficient'],
  404: ['checklist-item.not-found', 'task.not-found', 'task.trashed', 'organization.not-found'],
  409: ['task.archived'],
  412: ['request.version-mismatch'],
};

/**
 * Constant ASSIGN_TASK_PROBLEMS
 *
 * @description
 * Client errors of task-service that `PUT /v1/tasks/{taskKey}/assignees/{userId}` answers as they
 * are: the codes its public operation declares. Any other is `503 upstream.failed`.
 *
 * @type {AcceptedProblems}
 */
const ASSIGN_TASK_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  403: ['access.role-insufficient'],
  404: ['task.not-found', 'task.trashed', 'organization.not-found'],
  409: ['task.archived'],
  412: ['request.version-mismatch'],
  422: ['task.assignee-invalid', 'task.assignee-limit-reached'],
};

/**
 * Constant UNASSIGN_TASK_PROBLEMS
 *
 * @description
 * Client errors of task-service that `DELETE /v1/tasks/{taskKey}/assignees/{userId}` answers as they
 * are: the codes its public operation declares. Any other is `503 upstream.failed`.
 *
 * @type {AcceptedProblems}
 */
const UNASSIGN_TASK_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  403: ['access.role-insufficient'],
  404: ['task.not-found', 'task.trashed', 'organization.not-found'],
  409: ['task.archived'],
  412: ['request.version-mismatch'],
};

/**
 * Constant ADD_TASK_LABEL_PROBLEMS
 *
 * @description
 * Client errors of task-service that `POST /v1/tasks/{taskKey}/labels/add` answers as they
 * are: the codes its public operation declares. Any other is `503 upstream.failed`.
 *
 * @type {AcceptedProblems}
 */
const ADD_TASK_LABEL_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  403: ['access.role-insufficient'],
  404: ['task.not-found', 'task.trashed', 'organization.not-found'],
  409: ['task.archived'],
  412: ['request.version-mismatch'],
  422: ['task.label-limit-reached'],
};

/**
 * Constant REMOVE_TASK_LABEL_PROBLEMS
 *
 * @description
 * Client errors of task-service that `POST /v1/tasks/{taskKey}/labels/remove` answers as they
 * are: the codes its public operation declares. Any other is `503 upstream.failed`.
 *
 * @type {AcceptedProblems}
 */
const REMOVE_TASK_LABEL_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  403: ['access.role-insufficient'],
  404: ['task.not-found', 'task.trashed', 'organization.not-found'],
  409: ['task.archived'],
  412: ['request.version-mismatch'],
};

/**
 * Constant LIST_TASK_ACTIVITY_PROBLEMS
 *
 * @description
 * Client errors of task-service that `GET /v1/tasks/{taskKey}/activity` answers as they
 * are: the codes its public operation declares. Any other is `503 upstream.failed`.
 *
 * @type {AcceptedProblems}
 */
const LIST_TASK_ACTIVITY_PROBLEMS: AcceptedProblems = {
  400: ['request.invalid'],
  404: ['task.not-found', 'task.trashed', 'organization.not-found'],
};

/**
 * Constant LIST_TASK_ACTIVITY_QUERY
 *
 * @description
 * The query of `GET /v1/tasks/{taskKey}/activity` as the contract validates it, with `kind` split on
 * their commas first (`style: form, explode: false`).
 *
 * @type {z.ZodType}
 */
const LIST_TASK_ACTIVITY_QUERY = ListTaskActivityQueryParams.extend({
  kind: z.preprocess(toQueryList, ListTaskActivityQueryParams.shape.kind),
});

/**
 * Constant ASSIGN_TASK_BODY
 *
 * @description
 * Validator of the body of `PUT /v1/tasks/{taskKey}/assignees/{userId}`: an empty object, with no
 * other member. The contract's `EmptyRequest` declares `additionalProperties: false`, which the
 * generated validator does not enforce, so a body with any member answers `400 request.invalid`.
 *
 * @type {z.ZodType<Record<string, never>>}
 */
const ASSIGN_TASK_BODY: z.ZodType<Record<string, never>> = AssignTaskBody.strict();

/**
 * Class TasksController
 *
 * @description
 * The task routes of `openapi/public/tasks.yaml` on a list or a task: list, count, create, read and change the tasks, their subtasks, checklist, assignees, labels and activity, and the detail the gateway composes.
 *
 * Every route accepts the session cookie or a personal API token with `tasks:read` (reads) or
 * `tasks:write` (writes, spaces and lists included), on the current organization:
 * `CredentialGuard` answers `403 auth.scope-missing`, `403 organization.not-selected` and
 * `403 organization.mfa-required` before any call, and `RateLimitGuard` counts the credential.
 * task-service decides everything, the roles on a list (`403 access.role-insufficient`), a task
 * in the trash (`404 task.trashed`, with its `details`) and an archived task (`409 task.archived`
 * on a change, an ordinary answer on a read) included; the gateway relays the client errors each
 * public operation declares, with their French titles, and maps every answer to the public
 * contract through its public validator.
 */
@Controller('v1')
@UseGuards(CredentialGuard, RateLimitGuard)
export class TasksController {
  // #region Properties
  /**
   * Property taskListing
   *
   * @description
   * Use case `ListTasks`.
   *
   * @type {ListTasks}
   * @readonly
   */
  private readonly taskListing: ListTasks;

  /**
   * Property taskCreation
   *
   * @description
   * Use case `CreateTask`.
   *
   * @type {CreateTask}
   * @readonly
   */
  private readonly taskCreation: CreateTask;

  /**
   * Property groupCounting
   *
   * @description
   * Use case `CountTaskGroups`.
   *
   * @type {CountTaskGroups}
   * @readonly
   */
  private readonly groupCounting: CountTaskGroups;

  /**
   * Property taskReading
   *
   * @description
   * Use case `GetTask`.
   *
   * @type {GetTask}
   * @readonly
   */
  private readonly taskReading: GetTask;

  /**
   * Property taskChange
   *
   * @description
   * Use case `UpdateTask`.
   *
   * @type {UpdateTask}
   * @readonly
   */
  private readonly taskChange: UpdateTask;

  /**
   * Property detailReading
   *
   * @description
   * Use case `GetTaskDetail`.
   *
   * @type {GetTaskDetail}
   * @readonly
   */
  private readonly detailReading: GetTaskDetail;

  /**
   * Property subtaskListing
   *
   * @description
   * Use case `ListSubtasks`.
   *
   * @type {ListSubtasks}
   * @readonly
   */
  private readonly subtaskListing: ListSubtasks;

  /**
   * Property subtaskCreation
   *
   * @description
   * Use case `CreateSubtask`.
   *
   * @type {CreateSubtask}
   * @readonly
   */
  private readonly subtaskCreation: CreateSubtask;

  /**
   * Property checklistAddition
   *
   * @description
   * Use case `AddChecklistItem`.
   *
   * @type {AddChecklistItem}
   * @readonly
   */
  private readonly checklistAddition: AddChecklistItem;

  /**
   * Property checklistChange
   *
   * @description
   * Use case `UpdateChecklistItem`.
   *
   * @type {UpdateChecklistItem}
   * @readonly
   */
  private readonly checklistChange: UpdateChecklistItem;

  /**
   * Property assignment
   *
   * @description
   * Use case `AssignTask`.
   *
   * @type {AssignTask}
   * @readonly
   */
  private readonly assignment: AssignTask;

  /**
   * Property unassignment
   *
   * @description
   * Use case `UnassignTask`.
   *
   * @type {UnassignTask}
   * @readonly
   */
  private readonly unassignment: UnassignTask;

  /**
   * Property labelAddition
   *
   * @description
   * Use case `AddTaskLabel`.
   *
   * @type {AddTaskLabel}
   * @readonly
   */
  private readonly labelAddition: AddTaskLabel;

  /**
   * Property labelRemoval
   *
   * @description
   * Use case `RemoveTaskLabel`.
   *
   * @type {RemoveTaskLabel}
   * @readonly
   */
  private readonly labelRemoval: RemoveTaskLabel;

  /**
   * Property activityListing
   *
   * @description
   * Use case `ListTaskActivity`.
   *
   * @type {ListTaskActivity}
   * @readonly
   */
  private readonly activityListing: ListTaskActivity;
  // #endregion

  // #region Constructor
  /**
   * Constructor
   *
   * @description
   * Receives the use cases of the routes.
   *
   * @param {ListTasks} taskListing - Use case `ListTasks`.
   * @param {CreateTask} taskCreation - Use case `CreateTask`.
   * @param {CountTaskGroups} groupCounting - Use case `CountTaskGroups`.
   * @param {GetTask} taskReading - Use case `GetTask`.
   * @param {UpdateTask} taskChange - Use case `UpdateTask`.
   * @param {GetTaskDetail} detailReading - Use case `GetTaskDetail`.
   * @param {ListSubtasks} subtaskListing - Use case `ListSubtasks`.
   * @param {CreateSubtask} subtaskCreation - Use case `CreateSubtask`.
   * @param {AddChecklistItem} checklistAddition - Use case `AddChecklistItem`.
   * @param {UpdateChecklistItem} checklistChange - Use case `UpdateChecklistItem`.
   * @param {AssignTask} assignment - Use case `AssignTask`.
   * @param {UnassignTask} unassignment - Use case `UnassignTask`.
   * @param {AddTaskLabel} labelAddition - Use case `AddTaskLabel`.
   * @param {RemoveTaskLabel} labelRemoval - Use case `RemoveTaskLabel`.
   * @param {ListTaskActivity} activityListing - Use case `ListTaskActivity`.
   * @constructor
   */
  public constructor(
    @Inject(ListTasks) taskListing: ListTasks,
    @Inject(CreateTask) taskCreation: CreateTask,
    @Inject(CountTaskGroups) groupCounting: CountTaskGroups,
    @Inject(GetTask) taskReading: GetTask,
    @Inject(UpdateTask) taskChange: UpdateTask,
    @Inject(GetTaskDetail) detailReading: GetTaskDetail,
    @Inject(ListSubtasks) subtaskListing: ListSubtasks,
    @Inject(CreateSubtask) subtaskCreation: CreateSubtask,
    @Inject(AddChecklistItem) checklistAddition: AddChecklistItem,
    @Inject(UpdateChecklistItem) checklistChange: UpdateChecklistItem,
    @Inject(AssignTask) assignment: AssignTask,
    @Inject(UnassignTask) unassignment: UnassignTask,
    @Inject(AddTaskLabel) labelAddition: AddTaskLabel,
    @Inject(RemoveTaskLabel) labelRemoval: RemoveTaskLabel,
    @Inject(ListTaskActivity) activityListing: ListTaskActivity,
  ) {
    this.taskListing = taskListing;
    this.taskCreation = taskCreation;
    this.groupCounting = groupCounting;
    this.taskReading = taskReading;
    this.taskChange = taskChange;
    this.detailReading = detailReading;
    this.subtaskListing = subtaskListing;
    this.subtaskCreation = subtaskCreation;
    this.checklistAddition = checklistAddition;
    this.checklistChange = checklistChange;
    this.assignment = assignment;
    this.unassignment = unassignment;
    this.labelAddition = labelAddition;
    this.labelRemoval = labelRemoval;
    this.activityListing = activityListing;
  }
  // #endregion

  // #region Methods
  /**
   * Method listTasks
   *
   * @description
   * `GET /v1/lists/{listId}/tasks`: one page of the tasks of a list, filtered and sorted; `assignee=me` is relayed for task-service to resolve.
   *
   * @param {z.output<typeof ListTasksParams>} params - The path parameters.
   * @param {z.output<typeof LIST_TASKS_QUERY>} query - The query, validated.
   * @returns {Promise<z.output<typeof ListTasksResponse>>} The answer, mapped to the public contract.
   */
  @Get('lists/:listId/tasks')
  @CredentialGuard.requires({
    operationId: 'listTasks',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:read'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async listTasks(
    @Param(new ZodValidationPipe(ListTasksParams)) params: z.output<typeof ListTasksParams>,
    @Query(new ZodValidationPipe(LIST_TASKS_QUERY)) query: z.output<typeof LIST_TASKS_QUERY>,
  ): Promise<z.output<typeof ListTasksResponse>> {
    return conformBody(
      TASK_SERVICE,
      'listTasks',
      ListTasksResponse,
      await relayProblems(LIST_TASKS_PROBLEMS, () =>
        this.taskListing.execute(params.listId, query),
      ),
    );
  }

  /** Lists tasks using filters supplied in a JSON body. */
  @QueryMethod('lists/:listId/tasks')
  @CredentialGuard.requires({
    operationId: 'queryListTasks',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:read'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async queryListTasks(
    @Param(new ZodValidationPipe(ListTasksParams)) params: z.output<typeof ListTasksParams>,
    @RequiredBody(QueryListTasksBody) body: z.output<typeof QueryListTasksBody>,
  ): Promise<z.output<typeof ListTasksResponse>> {
    return conformBody(
      TASK_SERVICE,
      'queryListTasks',
      ListTasksResponse,
      await relayProblems(LIST_TASKS_PROBLEMS, () =>
        this.taskListing.execute(params.listId, body, 'QUERY'),
      ),
    );
  }

  /**
   * Method createTask
   *
   * @description
   * `POST /v1/lists/{listId}/tasks`: creates a task and its subtasks. `201` with `Location: /v1/tasks/<key>` and its `ETag`; `Idempotency-Key` is relayed unchanged.
   *
   * @param {z.output<typeof CreateTaskParams>} params - The path parameters.
   * @param {z.output<typeof CreateTaskBody>} body - The body, validated.
   * @param {string | undefined} idempotencyKeyHeader - `Idempotency-Key` of the request.
   * @param {Response} response - Response, for its headers.
   * @returns {Promise<z.output<typeof CreateTaskResponse>>} The answer, mapped to the public contract.
   */
  @Post('lists/:listId/tasks')
  @CredentialGuard.requires({
    operationId: 'createTask',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
  })
  public async createTask(
    @Param(new ZodValidationPipe(CreateTaskParams)) params: z.output<typeof CreateTaskParams>,
    @RequiredBody(CreateTaskBody) body: z.output<typeof CreateTaskBody>,
    @Headers('idempotency-key') idempotencyKeyHeader: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof CreateTaskResponse>> {
    const idempotencyKey: string | undefined = toRequestHeader(
      'Idempotency-Key',
      CreateTaskHeader.shape['Idempotency-Key'],
      idempotencyKeyHeader,
    );
    const created: z.output<typeof CreateTaskResponse> = conformBody(
      TASK_SERVICE,
      'createTask',
      CreateTaskResponse,
      await relayProblems(CREATE_TASK_PROBLEMS, () =>
        this.taskCreation.execute(params.listId, body, idempotencyKey),
      ),
    );
    response.setHeader('Location', `/v1/tasks/${created.key}`);
    return created;
  }

  /**
   * Method countTaskGroups
   *
   * @description
   * `GET /v1/lists/{listId}/task-groups`: counts the tasks of a list that match the filters, by group.
   *
   * @param {z.output<typeof CountTaskGroupsParams>} params - The path parameters.
   * @param {z.output<typeof COUNT_TASK_GROUPS_QUERY>} query - The query, validated.
   * @returns {Promise<z.output<typeof CountTaskGroupsResponse>>} The answer, mapped to the public contract.
   */
  @Get('lists/:listId/task-groups')
  @CredentialGuard.requires({
    operationId: 'countTaskGroups',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:read'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async countTaskGroups(
    @Param(new ZodValidationPipe(CountTaskGroupsParams))
    params: z.output<typeof CountTaskGroupsParams>,
    @Query(new ZodValidationPipe(COUNT_TASK_GROUPS_QUERY))
    query: z.output<typeof COUNT_TASK_GROUPS_QUERY>,
  ): Promise<z.output<typeof CountTaskGroupsResponse>> {
    return conformBody(
      TASK_SERVICE,
      'countTaskGroups',
      CountTaskGroupsResponse,
      await relayProblems(COUNT_TASK_GROUPS_PROBLEMS, () =>
        this.groupCounting.execute(params.listId, query),
      ),
    );
  }

  /** Counts task groups using filters supplied in a JSON body. */
  @QueryMethod('lists/:listId/task-groups')
  @CredentialGuard.requires({
    operationId: 'queryCountTaskGroups',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:read'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async queryCountTaskGroups(
    @Param(new ZodValidationPipe(CountTaskGroupsParams))
    params: z.output<typeof CountTaskGroupsParams>,
    @RequiredBody(QueryCountTaskGroupsBody) body: z.output<typeof QueryCountTaskGroupsBody>,
  ): Promise<z.output<typeof CountTaskGroupsResponse>> {
    return conformBody(
      TASK_SERVICE,
      'queryCountTaskGroups',
      CountTaskGroupsResponse,
      await relayProblems(COUNT_TASK_GROUPS_PROBLEMS, () =>
        this.groupCounting.execute(params.listId, body, 'QUERY'),
      ),
    );
  }

  /**
   * Method getTask
   *
   * @description
   * `GET /v1/tasks/{taskKey}`: one task, with its `ETag`.
   *
   * @param {z.output<typeof GetTaskParams>} params - The path parameters.
   * @returns {Promise<z.output<typeof GetTaskResponse>>} The answer, mapped to the public contract.
   */
  @Get('tasks/:taskKey')
  @CredentialGuard.requires({
    operationId: 'getTask',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:read'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async getTask(
    @Param(new ZodValidationPipe(GetTaskParams)) params: z.output<typeof GetTaskParams>,
  ): Promise<z.output<typeof GetTaskResponse>> {
    return conformBody(
      TASK_SERVICE,
      'getTask',
      GetTaskResponse,
      await relayProblems(GET_TASK_PROBLEMS, () => this.taskReading.execute(params.taskKey)),
    );
  }

  /**
   * Method updateTask
   *
   * @description
   * `PATCH /v1/tasks/{taskKey}`: changes a task (JSON Merge Patch), with `If-Match` relayed unchanged; task-service requires it to change the description.
   *
   * @param {z.output<typeof UpdateTaskParams>} params - The path parameters.
   * @param {z.output<typeof UpdateTaskBody>} body - The body, validated.
   * @param {string | undefined} ifMatch - `If-Match` of the request, relayed unchanged.
   * @returns {Promise<z.output<typeof UpdateTaskResponse>>} The answer, mapped to the public contract.
   */
  @Patch('tasks/:taskKey')
  @CredentialGuard.requires({
    operationId: 'updateTask',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async updateTask(
    @Param(new ZodValidationPipe(UpdateTaskParams)) params: z.output<typeof UpdateTaskParams>,
    @RequiredBody(UpdateTaskBody) body: z.output<typeof UpdateTaskBody>,
    @IfMatchHeader() ifMatch: string | undefined,
  ): Promise<z.output<typeof UpdateTaskResponse>> {
    return conformBody(
      TASK_SERVICE,
      'updateTask',
      UpdateTaskResponse,
      await relayProblems(UPDATE_TASK_PROBLEMS, () =>
        this.taskChange.execute(params.taskKey, body, ifMatch),
      ),
    );
  }

  /**
   * Method getTaskDetail
   *
   * @description
   * `GET /v1/tasks/{taskKey}/detail`: the detail of a task the gateway composes (see `GetTaskDetail`), with the `ETag` of the task. `partial` names secondary parts that could not be read.
   *
   * @param {z.output<typeof GetTaskDetailParams>} params - The path parameters.
   * @param {Response} response - Response, for its headers.
   * @returns {Promise<z.output<typeof GetTaskDetailResponse>>} The answer, mapped to the public contract.
   */
  @Get('tasks/:taskKey/detail')
  @CredentialGuard.requires({
    operationId: 'getTaskDetail',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:read'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async getTaskDetail(
    @Param(new ZodValidationPipe(GetTaskDetailParams)) params: z.output<typeof GetTaskDetailParams>,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof GetTaskDetailResponse>> {
    const detail: TaskDetail = await relayProblems(GET_TASK_DETAIL_PROBLEMS, () =>
      this.detailReading.execute(params.taskKey),
    );
    const answer: z.output<typeof GetTaskDetailResponse> = conformBody(
      TASK_SERVICE,
      'getTaskDetail',
      GetTaskDetailResponse,
      {
        ...detail.core,
        ...(detail.parts.has('comments') ? { comments: detail.parts.get('comments') } : {}),
        partial: detail.partial,
      },
    );
    response.setHeader('ETag', formatEtag(answer.task.version));
    return answer;
  }

  /**
   * Method listSubtasks
   *
   * @description
   * `GET /v1/tasks/{taskKey}/subtasks`: one page of the direct subtasks of a task.
   *
   * @param {z.output<typeof ListSubtasksParams>} params - The path parameters.
   * @param {z.output<typeof ListSubtasksQueryParams>} query - The query, validated.
   * @returns {Promise<z.output<typeof ListSubtasksResponse>>} The answer, mapped to the public contract.
   */
  @Get('tasks/:taskKey/subtasks')
  @CredentialGuard.requires({
    operationId: 'listSubtasks',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:read'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async listSubtasks(
    @Param(new ZodValidationPipe(ListSubtasksParams)) params: z.output<typeof ListSubtasksParams>,
    @Query(new ZodValidationPipe(ListSubtasksQueryParams))
    query: z.output<typeof ListSubtasksQueryParams>,
  ): Promise<z.output<typeof ListSubtasksResponse>> {
    return conformBody(
      TASK_SERVICE,
      'listSubtasks',
      ListSubtasksResponse,
      await relayProblems(LIST_SUBTASKS_PROBLEMS, () =>
        this.subtaskListing.execute(params.taskKey, query),
      ),
    );
  }

  /**
   * Method createSubtask
   *
   * @description
   * `POST /v1/tasks/{taskKey}/subtasks`: creates a subtask. `201` with `Location: /v1/tasks/<key>` and its `ETag`; `Idempotency-Key` is relayed unchanged.
   *
   * @param {z.output<typeof CreateSubtaskParams>} params - The path parameters.
   * @param {z.output<typeof CreateSubtaskBody>} body - The body, validated.
   * @param {string | undefined} idempotencyKeyHeader - `Idempotency-Key` of the request.
   * @param {Response} response - Response, for its headers.
   * @returns {Promise<z.output<typeof CreateSubtaskResponse>>} The answer, mapped to the public contract.
   */
  @Post('tasks/:taskKey/subtasks')
  @CredentialGuard.requires({
    operationId: 'createSubtask',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async createSubtask(
    @Param(new ZodValidationPipe(CreateSubtaskParams)) params: z.output<typeof CreateSubtaskParams>,
    @RequiredBody(CreateSubtaskBody) body: z.output<typeof CreateSubtaskBody>,
    @Headers('idempotency-key') idempotencyKeyHeader: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof CreateSubtaskResponse>> {
    const idempotencyKey: string | undefined = toRequestHeader(
      'Idempotency-Key',
      CreateSubtaskHeader.shape['Idempotency-Key'],
      idempotencyKeyHeader,
    );
    const created: z.output<typeof CreateSubtaskResponse> = conformBody(
      TASK_SERVICE,
      'createSubtask',
      CreateSubtaskResponse,
      await relayProblems(CREATE_SUBTASK_PROBLEMS, () =>
        this.subtaskCreation.execute(params.taskKey, body, idempotencyKey),
      ),
    );
    response.setHeader('Location', `/v1/tasks/${created.key}`);
    return created;
  }

  /**
   * Method addChecklistItem
   *
   * @description
   * `POST /v1/tasks/{taskKey}/checklist-items`: adds an item to the checklist. `201` with the task, its `ETag` and `Location: /v1/tasks/<key>/checklist-items/<checklistItemId>`; `Idempotency-Key` is relayed unchanged.
   *
   * @param {z.output<typeof AddChecklistItemParams>} params - The path parameters.
   * @param {z.output<typeof AddChecklistItemBody>} body - The body, validated.
   * @param {string | undefined} idempotencyKeyHeader - `Idempotency-Key` of the request.
   * @param {Response} response - Response, for its headers.
   * @returns {Promise<z.output<typeof AddChecklistItemResponse>>} The answer, mapped to the public contract.
   */
  @Post('tasks/:taskKey/checklist-items')
  @CredentialGuard.requires({
    operationId: 'addChecklistItem',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async addChecklistItem(
    @Param(new ZodValidationPipe(AddChecklistItemParams))
    params: z.output<typeof AddChecklistItemParams>,
    @RequiredBody(AddChecklistItemBody) body: z.output<typeof AddChecklistItemBody>,
    @Headers('idempotency-key') idempotencyKeyHeader: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof AddChecklistItemResponse>> {
    const idempotencyKey: string | undefined = toRequestHeader(
      'Idempotency-Key',
      AddChecklistItemHeader.shape['Idempotency-Key'],
      idempotencyKeyHeader,
    );
    const added: AddedChecklistItem = await relayProblems(ADD_CHECKLIST_ITEM_PROBLEMS, () =>
      this.checklistAddition.execute(params.taskKey, body, idempotencyKey),
    );
    const task: z.output<typeof AddChecklistItemResponse> = conformBody(
      TASK_SERVICE,
      'addChecklistItem',
      AddChecklistItemResponse,
      added.task,
    );
    response.setHeader(
      'Location',
      `/v1/tasks/${task.key}/checklist-items/${added.checklistItemId}`,
    );
    return task;
  }

  /**
   * Method updateChecklistItem
   *
   * @description
   * `PATCH /v1/tasks/{taskKey}/checklist-items/{checklistItemId}`: ticks or unticks a checklist item, with `If-Match` relayed unchanged.
   *
   * @param {z.output<typeof UpdateChecklistItemParams>} params - The path parameters.
   * @param {z.output<typeof UpdateChecklistItemBody>} body - The body, validated.
   * @param {string | undefined} ifMatch - `If-Match` of the request, relayed unchanged.
   * @returns {Promise<z.output<typeof UpdateChecklistItemResponse>>} The answer, mapped to the public contract.
   */
  @Patch('tasks/:taskKey/checklist-items/:checklistItemId')
  @CredentialGuard.requires({
    operationId: 'updateChecklistItem',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async updateChecklistItem(
    @Param(new ZodValidationPipe(UpdateChecklistItemParams))
    params: z.output<typeof UpdateChecklistItemParams>,
    @RequiredBody(UpdateChecklistItemBody)
    body: z.output<typeof UpdateChecklistItemBody>,
    @IfMatchHeader() ifMatch: string | undefined,
  ): Promise<z.output<typeof UpdateChecklistItemResponse>> {
    return conformBody(
      TASK_SERVICE,
      'updateChecklistItem',
      UpdateChecklistItemResponse,
      await relayProblems(UPDATE_CHECKLIST_ITEM_PROBLEMS, () =>
        this.checklistChange.execute(params.taskKey, params.checklistItemId, body, ifMatch),
      ),
    );
  }

  /**
   * Method assignTask
   *
   * @description
   * `PUT /v1/tasks/{taskKey}/assignees/{userId}`: assigns a member, with `If-Match` relayed unchanged. The empty body is checked and not relayed.
   *
   * @param {z.output<typeof AssignTaskParams>} params - The path parameters.
   * @param {z.output<typeof ASSIGN_TASK_BODY>} body - The empty body, validated.
   * @param {string | undefined} ifMatch - `If-Match` of the request, relayed unchanged.
   * @returns {Promise<z.output<typeof AssignTaskResponse>>} The answer, mapped to the public contract.
   */
  @Put('tasks/:taskKey/assignees/:userId')
  @CredentialGuard.requires({
    operationId: 'assignTask',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async assignTask(
    @Param(new ZodValidationPipe(AssignTaskParams)) params: z.output<typeof AssignTaskParams>,
    @RequiredBody(ASSIGN_TASK_BODY) body: z.output<typeof ASSIGN_TASK_BODY>,
    @IfMatchHeader() ifMatch: string | undefined,
  ): Promise<z.output<typeof AssignTaskResponse>> {
    return conformBody(
      TASK_SERVICE,
      'assignTask',
      AssignTaskResponse,
      await relayProblems(ASSIGN_TASK_PROBLEMS, () =>
        this.assignment.execute(params.taskKey, params.userId, ifMatch),
      ),
    );
  }

  /**
   * Method unassignTask
   *
   * @description
   * `DELETE /v1/tasks/{taskKey}/assignees/{userId}`: unassigns a member, with `If-Match` relayed unchanged. `204` with the `ETag` task-service answered.
   *
   * @param {z.output<typeof UnassignTaskParams>} params - The path parameters.
   * @param {string | undefined} ifMatch - `If-Match` of the request, relayed unchanged.
   * @param {Response} response - Response, for its headers.
   * @returns {Promise<void>} Resolves once the member is unassigned.
   */
  @Delete('tasks/:taskKey/assignees/:userId')
  @HttpCode(204)
  @CredentialGuard.requires({
    operationId: 'unassignTask',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async unassignTask(
    @Param(new ZodValidationPipe(UnassignTaskParams)) params: z.output<typeof UnassignTaskParams>,
    @IfMatchHeader() ifMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const version: number = await relayProblems(UNASSIGN_TASK_PROBLEMS, () =>
      this.unassignment.execute(params.taskKey, params.userId, ifMatch),
    );
    response.setHeader('ETag', formatEtag(version));
  }

  /**
   * Method addTaskLabel
   *
   * @description
   * `POST /v1/tasks/{taskKey}/labels/add`: adds a label, with `If-Match` relayed unchanged. `200` with the task.
   *
   * @param {z.output<typeof AddTaskLabelParams>} params - The path parameters.
   * @param {z.output<typeof AddTaskLabelBody>} body - The body, validated.
   * @param {string | undefined} ifMatch - `If-Match` of the request, relayed unchanged.
   * @returns {Promise<z.output<typeof AddTaskLabelResponse>>} The answer, mapped to the public contract.
   */
  @Post('tasks/:taskKey/labels/add')
  @HttpCode(200)
  @CredentialGuard.requires({
    operationId: 'addTaskLabel',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async addTaskLabel(
    @Param(new ZodValidationPipe(AddTaskLabelParams)) params: z.output<typeof AddTaskLabelParams>,
    @RequiredBody(AddTaskLabelBody) body: z.output<typeof AddTaskLabelBody>,
    @IfMatchHeader() ifMatch: string | undefined,
  ): Promise<z.output<typeof AddTaskLabelResponse>> {
    return conformBody(
      TASK_SERVICE,
      'addTaskLabel',
      AddTaskLabelResponse,
      await relayProblems(ADD_TASK_LABEL_PROBLEMS, () =>
        this.labelAddition.execute(params.taskKey, body, ifMatch),
      ),
    );
  }

  /**
   * Method removeTaskLabel
   *
   * @description
   * `POST /v1/tasks/{taskKey}/labels/remove`: removes a label, with `If-Match` relayed unchanged. `200` with the task.
   *
   * @param {z.output<typeof RemoveTaskLabelParams>} params - The path parameters.
   * @param {z.output<typeof RemoveTaskLabelBody>} body - The body, validated.
   * @param {string | undefined} ifMatch - `If-Match` of the request, relayed unchanged.
   * @returns {Promise<z.output<typeof RemoveTaskLabelResponse>>} The answer, mapped to the public contract.
   */
  @Post('tasks/:taskKey/labels/remove')
  @HttpCode(200)
  @CredentialGuard.requires({
    operationId: 'removeTaskLabel',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async removeTaskLabel(
    @Param(new ZodValidationPipe(RemoveTaskLabelParams))
    params: z.output<typeof RemoveTaskLabelParams>,
    @RequiredBody(RemoveTaskLabelBody) body: z.output<typeof RemoveTaskLabelBody>,
    @IfMatchHeader() ifMatch: string | undefined,
  ): Promise<z.output<typeof RemoveTaskLabelResponse>> {
    return conformBody(
      TASK_SERVICE,
      'removeTaskLabel',
      RemoveTaskLabelResponse,
      await relayProblems(REMOVE_TASK_LABEL_PROBLEMS, () =>
        this.labelRemoval.execute(params.taskKey, body, ifMatch),
      ),
    );
  }

  /**
   * Method listTaskActivity
   *
   * @description
   * `GET /v1/tasks/{taskKey}/activity`: one page of the activity of a task.
   *
   * @param {z.output<typeof ListTaskActivityParams>} params - The path parameters.
   * @param {z.output<typeof LIST_TASK_ACTIVITY_QUERY>} query - The query, validated.
   * @returns {Promise<z.output<typeof ListTaskActivityResponse>>} The answer, mapped to the public contract.
   */
  @Get('tasks/:taskKey/activity')
  @CredentialGuard.requires({
    operationId: 'listTaskActivity',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:read'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async listTaskActivity(
    @Param(new ZodValidationPipe(ListTaskActivityParams))
    params: z.output<typeof ListTaskActivityParams>,
    @Query(new ZodValidationPipe(LIST_TASK_ACTIVITY_QUERY))
    query: z.output<typeof LIST_TASK_ACTIVITY_QUERY>,
  ): Promise<z.output<typeof ListTaskActivityResponse>> {
    return conformBody(
      TASK_SERVICE,
      'listTaskActivity',
      ListTaskActivityResponse,
      await relayProblems(LIST_TASK_ACTIVITY_PROBLEMS, () =>
        this.activityListing.execute(params.taskKey, query),
      ),
    );
  }
  // #endregion
}

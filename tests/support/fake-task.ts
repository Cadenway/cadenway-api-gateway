import {
  AddChecklistItemInternalResponse,
  AddTaskLabelInternalResponse,
  ApproveAccessRequestInternalResponse,
  ArchiveListInternalResponse,
  ArchiveTaskInternalResponse,
  AssignTaskInternalResponse,
  CountTaskGroupsInternalResponse,
  CreateListInternalResponse,
  CreateSpaceInternalResponse,
  CreateSubtaskInternalResponse,
  CreateTaskInternalResponse,
  CreateTaskTimeEntryInternalResponse,
  ListSpaceCustomFieldsInternalResponse,
  ListListCustomFieldsInternalResponse,
  CreateSpaceCustomFieldInternalResponse,
  GetSpaceCustomFieldInternalResponse,
  UpdateSpaceCustomFieldInternalResponse,
  GetTaskApprovalInternalResponse,
  RequestTaskApprovalInternalResponse,
  VoteOnTaskApprovalInternalResponse,
  GetOnboardingInternalResponse,
  UpdateOnboardingInternalResponse,
  UpdateOnboardingChecklistInternalResponse,
  FinishOnboardingInternalResponse,
  GetTaskTimeEntryInternalResponse,
  GetTaskTimeSummaryInternalResponse,
  GetTaskStatusDurationsInternalResponse,
  ListTaskTimeEntriesInternalResponse,
  CreateTaskCommentInternalResponse,
  GetTaskCommentInternalResponse,
  UpdateTaskCommentInternalResponse,
  ListTaskParticipantsInternalResponse,
  DuplicateListInternalResponse,
  DuplicateTaskInternalResponse,
  ExecuteBulkTaskActionInternalResponse,
  EmptyTrashInternalResponse,
  GetHomeInternalResponse,
  GetListCountsInternalResponse,
  GetListInternalResponse,
  GetSpaceInternalResponse,
  GetSpaceOverviewInternalResponse,
  GetTaskDetailInternalResponse,
  GetTaskInternalResponse,
  GetTaskVisibilityInternalResponse,
  ListAccessRequestsInternalResponse,
  ListArchivedListsInternalResponse,
  ListArchivedTasksInternalResponse,
  ListLabelsInternalResponse,
  ListListActivityInternalResponse,
  ListListGrantsInternalResponse,
  ListListsInternalResponse,
  ListMyTasksInternalResponse,
  ListFavoritesInternalResponse,
  CreateFavoriteInternalResponse,
  GetFavoriteInternalResponse,
  ListSavedViewsInternalResponse,
  CreateSavedViewInternalResponse,
  GetSavedViewInternalResponse,
  UpdateSavedViewInternalResponse,
  DuplicateSavedViewInternalResponse,
  ListTaskTemplatesInternalResponse,
  CreateTaskTemplateInternalResponse,
  GetTaskTemplateInternalResponse,
  ListSpaceMilestonesInternalResponse,
  ListSpaceGrantsInternalResponse,
  ListSpacesInternalResponse,
  ListSubtasksInternalResponse,
  ListTaskDependenciesInternalResponse,
  CreateTaskDependencyInternalResponse,
  GetTaskDependencyInternalResponse,
  ListDependencyCandidatesInternalResponse,
  ListTaskWatchersInternalResponse,
  FollowTaskWatcherInternalResponse,
  ListTaskActivityInternalResponse,
  ListTasksInternalResponse,
  ListTrashInternalResponse,
  RefuseAccessRequestInternalResponse,
  RemoveTaskLabelInternalResponse,
  RestoreTrashEntryInternalResponse,
  SetListGrantInternalResponse,
  SetSpaceGrantInternalResponse,
  TrashTaskInternalResponse,
  UnarchiveListInternalResponse,
  UnarchiveTaskInternalResponse,
  UpdateChecklistItemInternalResponse,
  UpdateListInternalResponse,
  UpdateSpaceInternalResponse,
  UpdateTaskInternalResponse,
} from '@cadenway/contracts/validators/internal/task-service';
import { ProblemException, type ProblemStatus } from '@cadenway/nest-common';
import { vi, type Mock } from 'vitest';
import type { z } from 'zod';

import type { TaskServiceClient } from '../../src/clients/task-service.client.js';
import { responseExample, type SpecMethod } from './public-contract.js';

/**
 * The calls of the technical client of task-service.
 */
export type TaskServiceMethod = keyof TaskServiceClient;

/**
 * A fake of the technical client of task-service: one mock per call.
 */
export type FakeTask = {
  readonly [TMethod in TaskServiceMethod]: Mock<TaskServiceClient[TMethod]>;
};

/**
 * Reads the example of a public response and checks it against the internal validator of the
 * call that answers it: the public and internal contracts share their schemas, so every example
 * is also a valid internal answer.
 *
 * @param schema - Internal validator of the answer.
 * @param method - Method of the public operation.
 * @param path - Path of the public operation.
 * @param status - Success status of the public operation.
 * @returns The example, typed as the internal answer.
 */
export function internalExample<TSchema extends z.ZodType>(
  schema: TSchema,
  method: SpecMethod,
  path: string,
  status = 200,
): z.output<TSchema> {
  return schema.parse(responseExample(method, path, status));
}

/**
 * The detail of a task as task-service answers it: the public example without `partial`.
 *
 * @returns The `TaskDetailCore` of the example.
 */
export function taskDetailCore(): z.output<typeof GetTaskDetailInternalResponse> {
  return GetTaskDetailInternalResponse.parse(
    responseExample('get', '/v1/tasks/{taskKey}/detail', 200),
  );
}

/**
 * Version of the task the fake answers on the unassignment.
 */
export const UNASSIGNED_VERSION = 13;

/**
 * Version of the space the fake answers on giving or changing a grant of the space.
 */
export const SPACE_GRANT_VERSION = 8;

/**
 * Version of the space the fake answers on removing a grant of the space.
 */
export const SPACE_GRANT_REMOVED_VERSION = 9;

/**
 * Version of the list the fake answers on giving or changing a grant of the list.
 */
export const LIST_GRANT_VERSION = 4;

/**
 * Version of the list the fake answers on removing a grant of the list.
 */
export const LIST_GRANT_REMOVED_VERSION = 5;

/**
 * Id of the checklist item the fake answers on the addition.
 */
export const ADDED_CHECKLIST_ITEM_ID = '019a7c00-1a2b-7c3d-8e4f-5a6b7c8d9e99';

/**
 * Builds a client error of task-service as the internal HTTP client throws it.
 *
 * @param status - Status of the problem.
 * @param code - Code of the problem.
 * @param details - Details of the problem, `service` added.
 * @returns The problem.
 */
export function taskProblem(
  status: ProblemStatus,
  code: string,
  details: Readonly<Record<string, unknown>> = {},
): ProblemException {
  return new ProblemException({
    status,
    code,
    detail: 'Internal wording that never reaches the browser.',
    details: { ...details, service: 'task-service' },
  });
}

/**
 * Builds a fake of task-service whose every call answers the example of its public operation.
 *
 * @returns The fake.
 */
export function createFakeTask(): FakeTask {
  const task = (
    schema: z.ZodType,
    method: SpecMethod,
    path: string,
    status?: number,
  ): (() => Promise<never>) => {
    const answer: unknown = internalExample(schema, method, path, status);
    return () => Promise.resolve(answer as never);
  };
  return {
    resolveNotificationSubjects: vi.fn(
      (
        input: Parameters<TaskServiceClient['resolveNotificationSubjects']>[0] = {
          subjects: [{ subject: { kind: 'task-key', taskKey: 'CAD-482' } }],
        },
      ) => Promise.resolve({ results: input.subjects.map(() => ({ visible: false as const })) }),
    ),
    listSpaceCustomFields: vi.fn(
      task(ListSpaceCustomFieldsInternalResponse, 'get', '/v1/spaces/{spaceId}/custom-fields'),
    ),
    listListCustomFields: vi.fn(
      task(ListListCustomFieldsInternalResponse, 'get', '/v1/lists/{listId}/custom-fields'),
    ),
    createSpaceCustomField: vi.fn(() => {
      const field = internalExample(
        CreateSpaceCustomFieldInternalResponse,
        'post',
        '/v1/spaces/{spaceId}/custom-fields',
        201,
      );
      return Promise.resolve({ field, version: field.version });
    }),
    getSpaceCustomField: vi.fn(() => {
      const field = internalExample(
        GetSpaceCustomFieldInternalResponse,
        'get',
        '/v1/spaces/{spaceId}/custom-fields/{fieldId}',
      );
      return Promise.resolve({ field, version: field.version });
    }),
    updateSpaceCustomField: vi.fn(() => {
      const field = internalExample(
        UpdateSpaceCustomFieldInternalResponse,
        'patch',
        '/v1/spaces/{spaceId}/custom-fields/{fieldId}',
      );
      return Promise.resolve({ field, version: field.version });
    }),
    retireSpaceCustomField: vi.fn(() => Promise.resolve()),
    getTaskApproval: vi.fn(() => {
      const body = internalExample(
        GetTaskApprovalInternalResponse,
        'get',
        '/v1/tasks/{taskKey}/approvals',
      );
      return Promise.resolve({ body, version: body.taskVersion });
    }),
    requestTaskApproval: vi.fn(() => {
      const body = internalExample(
        RequestTaskApprovalInternalResponse,
        'post',
        '/v1/tasks/{taskKey}/approvals/request',
      );
      return Promise.resolve({ body, version: body.taskVersion });
    }),
    voteOnTaskApproval: vi.fn(() => {
      const body = internalExample(
        VoteOnTaskApprovalInternalResponse,
        'put',
        '/v1/tasks/{taskKey}/approvals/{roundId}/votes/me',
      );
      return Promise.resolve({ body, version: body.taskVersion });
    }),
    withdrawTaskApprovalVote: vi.fn(() => Promise.resolve({ version: 14 })),
    getOnboarding: vi.fn(() => {
      const body = internalExample(
        GetOnboardingInternalResponse,
        'post',
        '/v1/me/onboarding/finish',
        201,
      );
      return Promise.resolve({ body, version: body.version });
    }),
    updateOnboarding: vi.fn(() => {
      const body = internalExample(
        UpdateOnboardingInternalResponse,
        'post',
        '/v1/me/onboarding/finish',
        201,
      );
      return Promise.resolve({ body, version: body.version });
    }),
    updateOnboardingChecklist: vi.fn(() => {
      const body = internalExample(
        UpdateOnboardingChecklistInternalResponse,
        'post',
        '/v1/me/onboarding/finish',
        201,
      );
      return Promise.resolve({ body, version: body.version });
    }),
    finishOnboarding: vi.fn(() => {
      const body = internalExample(
        FinishOnboardingInternalResponse,
        'post',
        '/v1/me/onboarding/finish',
        201,
      );
      return Promise.resolve({ body, version: body.version });
    }),
    listTaskTimeEntries: vi.fn(
      task(ListTaskTimeEntriesInternalResponse, 'get', '/v1/tasks/{taskKey}/time-entries'),
    ),
    createTaskTimeEntry: vi.fn(
      task(CreateTaskTimeEntryInternalResponse, 'post', '/v1/tasks/{taskKey}/time-entries', 201),
    ),
    getTaskTimeEntry: vi.fn(() =>
      Promise.resolve(
        GetTaskTimeEntryInternalResponse.parse(
          responseExample('post', '/v1/tasks/{taskKey}/time-entries', 201),
        ),
      ),
    ),
    deleteTaskTimeEntry: vi.fn(() => Promise.resolve()),
    getTaskTimeSummary: vi.fn(
      task(GetTaskTimeSummaryInternalResponse, 'get', '/v1/tasks/{taskKey}/time-summary'),
    ),
    getTaskStatusDurations: vi.fn(
      task(GetTaskStatusDurationsInternalResponse, 'get', '/v1/tasks/{taskKey}/status-durations'),
    ),
    duplicateList: vi.fn(() =>
      Promise.resolve(
        DuplicateListInternalResponse.parse({
          list: responseExample('get', '/v1/lists/{listId}', 200),
          taskCount: 0,
        }),
      ),
    ),
    duplicateTask: vi.fn(() =>
      Promise.resolve(
        DuplicateTaskInternalResponse.parse(responseExample('get', '/v1/tasks/{taskKey}', 200)),
      ),
    ),
    executeBulkTaskAction: vi.fn(() =>
      Promise.resolve(
        ExecuteBulkTaskActionInternalResponse.parse({ results: [], affectedCount: 0 }),
      ),
    ),
    listFavorites: vi.fn(task(ListFavoritesInternalResponse, 'get', '/v1/me/favorites')),
    createFavorite: vi.fn(task(CreateFavoriteInternalResponse, 'post', '/v1/me/favorites', 201)),
    getFavorite: vi.fn(() =>
      Promise.resolve(
        GetFavoriteInternalResponse.parse(responseExample('post', '/v1/me/favorites', 201)),
      ),
    ),
    deleteFavorite: vi.fn(() => Promise.resolve()),
    listSavedViews: vi.fn(
      task(ListSavedViewsInternalResponse, 'get', '/v1/lists/{listId}/saved-views'),
    ),
    createSavedView: vi.fn(
      task(CreateSavedViewInternalResponse, 'post', '/v1/lists/{listId}/saved-views', 201),
    ),
    getSavedView: vi.fn(
      task(GetSavedViewInternalResponse, 'get', '/v1/lists/{listId}/saved-views/{viewId}'),
    ),
    updateSavedView: vi.fn(
      task(UpdateSavedViewInternalResponse, 'get', '/v1/lists/{listId}/saved-views/{viewId}'),
    ),
    deleteSavedView: vi.fn(() => Promise.resolve()),
    duplicateSavedView: vi.fn(
      task(
        DuplicateSavedViewInternalResponse,
        'post',
        '/v1/lists/{listId}/saved-views/{viewId}/duplicate',
        201,
      ),
    ),
    listTaskTemplates: vi.fn(
      task(ListTaskTemplatesInternalResponse, 'get', '/v1/spaces/{spaceId}/task-templates'),
    ),
    createTaskTemplate: vi.fn(
      task(CreateTaskTemplateInternalResponse, 'post', '/v1/spaces/{spaceId}/task-templates', 201),
    ),
    getTaskTemplate: vi.fn(
      task(
        GetTaskTemplateInternalResponse,
        'get',
        '/v1/spaces/{spaceId}/task-templates/{templateId}',
      ),
    ),
    deleteTaskTemplate: vi.fn(() => Promise.resolve()),
    listSpaceMilestones: vi.fn(
      task(ListSpaceMilestonesInternalResponse, 'get', '/v1/spaces/{spaceId}/milestones'),
    ),
    listSpaces: vi.fn(task(ListSpacesInternalResponse, 'get', '/v1/spaces')),
    createSpace: vi.fn(task(CreateSpaceInternalResponse, 'post', '/v1/spaces', 201)),
    getSpace: vi.fn(task(GetSpaceInternalResponse, 'get', '/v1/spaces/{spaceId}')),
    updateSpace: vi.fn(task(UpdateSpaceInternalResponse, 'patch', '/v1/spaces/{spaceId}')),
    deleteSpace: vi.fn(() => Promise.resolve()),
    getSpaceOverview: vi.fn(
      task(GetSpaceOverviewInternalResponse, 'get', '/v1/spaces/{spaceId}/overview'),
    ),
    createList: vi.fn(task(CreateListInternalResponse, 'post', '/v1/spaces/{spaceId}/lists', 201)),
    listLists: vi.fn(task(ListListsInternalResponse, 'get', '/v1/spaces/{spaceId}/lists')),
    getList: vi.fn(task(GetListInternalResponse, 'get', '/v1/lists/{listId}')),
    updateList: vi.fn(task(UpdateListInternalResponse, 'patch', '/v1/lists/{listId}')),
    deleteList: vi.fn(() => Promise.resolve()),
    getListCounts: vi.fn(task(GetListCountsInternalResponse, 'get', '/v1/lists/{listId}/counts')),
    listListActivity: vi.fn(
      task(ListListActivityInternalResponse, 'get', '/v1/lists/{listId}/activity'),
    ),
    listTasks: vi.fn(task(ListTasksInternalResponse, 'get', '/v1/lists/{listId}/tasks')),
    queryListTasks: vi.fn(task(ListTasksInternalResponse, 'get', '/v1/lists/{listId}/tasks')),
    queryCountTaskGroups: vi.fn(
      task(CountTaskGroupsInternalResponse, 'get', '/v1/lists/{listId}/task-groups'),
    ),
    queryListListActivity: vi.fn(
      task(ListListActivityInternalResponse, 'get', '/v1/lists/{listId}/activity'),
    ),
    createTask: vi.fn(task(CreateTaskInternalResponse, 'post', '/v1/lists/{listId}/tasks', 201)),
    countTaskGroups: vi.fn(
      task(CountTaskGroupsInternalResponse, 'get', '/v1/lists/{listId}/task-groups'),
    ),
    checkTaskAttachmentAccess: vi.fn(() => Promise.resolve()),
    getTask: vi.fn(task(GetTaskInternalResponse, 'get', '/v1/tasks/{taskKey}')),
    getTaskVisibility: vi.fn(() =>
      Promise.resolve(
        GetTaskVisibilityInternalResponse.parse({ visibleTaskKeys: [] }).visibleTaskKeys,
      ),
    ),
    updateTask: vi.fn(task(UpdateTaskInternalResponse, 'patch', '/v1/tasks/{taskKey}')),
    getTaskDetail: vi.fn(() => Promise.resolve(taskDetailCore())),
    listSubtasks: vi.fn(task(ListSubtasksInternalResponse, 'get', '/v1/tasks/{taskKey}/subtasks')),
    createSubtask: vi.fn(
      task(CreateSubtaskInternalResponse, 'post', '/v1/tasks/{taskKey}/subtasks', 201),
    ),
    addChecklistItem: vi.fn(() =>
      Promise.resolve({
        task: internalExample(
          AddChecklistItemInternalResponse,
          'post',
          '/v1/tasks/{taskKey}/checklist-items',
          201,
        ),
        checklistItemId: ADDED_CHECKLIST_ITEM_ID,
      }),
    ),
    updateChecklistItem: vi.fn(
      task(
        UpdateChecklistItemInternalResponse,
        'patch',
        '/v1/tasks/{taskKey}/checklist-items/{checklistItemId}',
      ),
    ),
    assignTask: vi.fn(
      task(AssignTaskInternalResponse, 'put', '/v1/tasks/{taskKey}/assignees/{userId}'),
    ),
    unassignTask: vi.fn(() => Promise.resolve(UNASSIGNED_VERSION)),
    addTaskLabel: vi.fn(
      task(AddTaskLabelInternalResponse, 'post', '/v1/tasks/{taskKey}/labels/add'),
    ),
    removeTaskLabel: vi.fn(
      task(RemoveTaskLabelInternalResponse, 'post', '/v1/tasks/{taskKey}/labels/remove'),
    ),
    createTaskComment: vi.fn(() =>
      Promise.resolve(
        internalExample(
          CreateTaskCommentInternalResponse,
          'post',
          '/v1/tasks/{taskKey}/comments',
          201,
        ),
      ),
    ),
    getTaskComment: vi.fn(() =>
      Promise.resolve(
        internalExample(
          GetTaskCommentInternalResponse,
          'get',
          '/v1/tasks/{taskKey}/comments/{commentId}',
        ),
      ),
    ),
    updateTaskComment: vi.fn(() =>
      Promise.resolve(
        internalExample(
          UpdateTaskCommentInternalResponse,
          'patch',
          '/v1/tasks/{taskKey}/comments/{commentId}',
        ),
      ),
    ),
    deleteTaskComment: vi.fn(() => Promise.resolve()),
    listTaskParticipants: vi.fn(() =>
      Promise.resolve(
        internalExample(
          ListTaskParticipantsInternalResponse,
          'get',
          '/v1/tasks/{taskKey}/participants',
        ),
      ),
    ),
    listTaskDependencies: vi.fn(
      task(ListTaskDependenciesInternalResponse, 'get', '/v1/tasks/{taskKey}/dependencies'),
    ),
    createTaskDependency: vi.fn(() =>
      Promise.resolve({
        dependency: internalExample(
          CreateTaskDependencyInternalResponse,
          'post',
          '/v1/tasks/{taskKey}/dependencies',
          201,
        ),
        version: 13,
      }),
    ),
    getTaskDependency: vi.fn(
      task(
        GetTaskDependencyInternalResponse,
        'get',
        '/v1/tasks/{taskKey}/dependencies/{dependencyId}',
      ),
    ),
    deleteTaskDependency: vi.fn(() => Promise.resolve(13)),
    listDependencyCandidates: vi.fn(() =>
      Promise.resolve(
        ListDependencyCandidatesInternalResponse.parse({ items: [], nextCursor: null, total: 0 }),
      ),
    ),
    listTaskWatchers: vi.fn(
      task(ListTaskWatchersInternalResponse, 'get', '/v1/tasks/{taskKey}/watchers'),
    ),
    followTaskWatcher: vi.fn(() =>
      Promise.resolve({
        watcher: internalExample(
          FollowTaskWatcherInternalResponse,
          'put',
          '/v1/tasks/{taskKey}/watchers/{userId}',
        ),
        version: 13,
      }),
    ),
    unfollowTaskWatcher: vi.fn(() => Promise.resolve(13)),
    listTaskComments: vi.fn(() => Promise.resolve({ items: [], nextCursor: null, total: 0 })),
    listTaskActivity: vi.fn(
      task(ListTaskActivityInternalResponse, 'get', '/v1/tasks/{taskKey}/activity'),
    ),
    listLabels: vi.fn(task(ListLabelsInternalResponse, 'get', '/v1/labels')),
    listMyTasks: vi.fn(task(ListMyTasksInternalResponse, 'get', '/v1/me/tasks')),
    getHome: vi.fn(task(GetHomeInternalResponse, 'get', '/v1/me/home')),
    listGoals: vi.fn(),
    createGoal: vi.fn(),
    getGoal: vi.fn(),
    updateGoal: vi.fn(),
    deleteGoal: vi.fn(),
    createGoalResult: vi.fn(),
    getGoalResult: vi.fn(),
    updateGoalResult: vi.fn(),
    deleteGoalResult: vi.fn(),
    getTeamDashboard: vi.fn(),
    getSprintReport: vi.fn(),
    getListWorkload: vi.fn(),
    queryGetListWorkload: vi.fn(),
    getListTimesheet: vi.fn(),
    exportListTasks: vi.fn(),
    queryExportListTasks: vi.fn(),
    getIntakeFormConfiguration: vi.fn(),
    updateIntakeFormConfiguration: vi.fn(),
    publishIntakeForm: vi.fn(),
    disableIntakeForm: vi.fn(),
    getTaskIntakeContact: vi.fn(),
    getPublicIntakeForm: vi.fn(),
    submitPublicIntakeForm: vi.fn(),
    allocateIntakeAttachment: vi.fn(),
    resolveIntakeAttachment: vi.fn(),
    releaseIntakeAttachment: vi.fn(),
    listSpaceGrants: vi.fn(
      task(ListSpaceGrantsInternalResponse, 'get', '/v1/spaces/{spaceId}/grants'),
    ),
    setSpaceGrant: vi.fn(() =>
      Promise.resolve({
        grant: internalExample(
          SetSpaceGrantInternalResponse,
          'put',
          '/v1/spaces/{spaceId}/grants/{userId}',
        ),
        version: SPACE_GRANT_VERSION,
      }),
    ),
    removeSpaceGrant: vi.fn(() => Promise.resolve(SPACE_GRANT_REMOVED_VERSION)),
    listListGrants: vi.fn(task(ListListGrantsInternalResponse, 'get', '/v1/lists/{listId}/grants')),
    setListGrant: vi.fn(() =>
      Promise.resolve({
        grant: internalExample(
          SetListGrantInternalResponse,
          'put',
          '/v1/lists/{listId}/grants/{userId}',
        ),
        version: LIST_GRANT_VERSION,
      }),
    ),
    removeListGrant: vi.fn(() => Promise.resolve(LIST_GRANT_REMOVED_VERSION)),
    createAccessRequest: vi.fn(() => Promise.resolve()),
    listAccessRequests: vi.fn(
      task(ListAccessRequestsInternalResponse, 'get', '/v1/access-requests'),
    ),
    approveAccessRequest: vi.fn(
      task(
        ApproveAccessRequestInternalResponse,
        'post',
        '/v1/access-requests/{accessRequestId}/approval',
      ),
    ),
    refuseAccessRequest: vi.fn(
      task(
        RefuseAccessRequestInternalResponse,
        'post',
        '/v1/access-requests/{accessRequestId}/refusal',
      ),
    ),
    archiveList: vi.fn(task(ArchiveListInternalResponse, 'post', '/v1/lists/{listId}/archive')),
    unarchiveList: vi.fn(
      task(UnarchiveListInternalResponse, 'post', '/v1/lists/{listId}/unarchive'),
    ),
    archiveTask: vi.fn(task(ArchiveTaskInternalResponse, 'post', '/v1/tasks/{taskKey}/archive')),
    unarchiveTask: vi.fn(
      task(UnarchiveTaskInternalResponse, 'post', '/v1/tasks/{taskKey}/unarchive'),
    ),
    listArchivedLists: vi.fn(task(ListArchivedListsInternalResponse, 'get', '/v1/archives/lists')),
    listArchivedTasks: vi.fn(task(ListArchivedTasksInternalResponse, 'get', '/v1/archives/tasks')),
    trashTask: vi.fn(task(TrashTaskInternalResponse, 'post', '/v1/tasks/{taskKey}/trash')),
    listTrash: vi.fn(task(ListTrashInternalResponse, 'get', '/v1/trash/entries')),
    purgeTrashEntry: vi.fn(() => Promise.resolve()),
    restoreTrashEntry: vi.fn(
      task(RestoreTrashEntryInternalResponse, 'post', '/v1/trash/entries/{entryId}/restore'),
    ),
    emptyTrash: vi.fn(task(EmptyTrashInternalResponse, 'post', '/v1/trash/empty', 202)),
  };
}

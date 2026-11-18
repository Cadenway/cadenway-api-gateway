import {
  AddChecklistItemInternalResponse,
  AddTaskLabelInternalResponse,
  AssignTaskInternalResponse,
  CountTaskGroupsInternalResponse,
  CreateListInternalResponse,
  CreateSpaceInternalResponse,
  CreateSubtaskInternalResponse,
  CreateTaskInternalResponse,
  GetHomeInternalResponse,
  GetListCountsInternalResponse,
  GetListInternalResponse,
  GetSpaceInternalResponse,
  GetSpaceOverviewInternalResponse,
  GetTaskDetailInternalResponse,
  GetTaskInternalResponse,
  ListLabelsInternalResponse,
  ListListActivityInternalResponse,
  ListListsInternalResponse,
  ListMyTasksInternalResponse,
  ListSpacesInternalResponse,
  ListSubtasksInternalResponse,
  ListTaskActivityInternalResponse,
  ListTasksInternalResponse,
  RemoveTaskLabelInternalResponse,
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
    listSpaces: vi.fn(task(ListSpacesInternalResponse, 'get', '/v1/spaces')),
    createSpace: vi.fn(task(CreateSpaceInternalResponse, 'post', '/v1/spaces', 201)),
    getSpace: vi.fn(task(GetSpaceInternalResponse, 'get', '/v1/spaces/{spaceId}')),
    updateSpace: vi.fn(task(UpdateSpaceInternalResponse, 'patch', '/v1/spaces/{spaceId}')),
    getSpaceOverview: vi.fn(
      task(GetSpaceOverviewInternalResponse, 'get', '/v1/spaces/{spaceId}/overview'),
    ),
    createList: vi.fn(task(CreateListInternalResponse, 'post', '/v1/spaces/{spaceId}/lists', 201)),
    listLists: vi.fn(task(ListListsInternalResponse, 'get', '/v1/spaces/{spaceId}/lists')),
    getList: vi.fn(task(GetListInternalResponse, 'get', '/v1/lists/{listId}')),
    updateList: vi.fn(task(UpdateListInternalResponse, 'patch', '/v1/lists/{listId}')),
    getListCounts: vi.fn(task(GetListCountsInternalResponse, 'get', '/v1/lists/{listId}/counts')),
    listListActivity: vi.fn(
      task(ListListActivityInternalResponse, 'get', '/v1/lists/{listId}/activity'),
    ),
    listTasks: vi.fn(task(ListTasksInternalResponse, 'get', '/v1/lists/{listId}/tasks')),
    createTask: vi.fn(task(CreateTaskInternalResponse, 'post', '/v1/lists/{listId}/tasks', 201)),
    countTaskGroups: vi.fn(
      task(CountTaskGroupsInternalResponse, 'get', '/v1/lists/{listId}/task-groups'),
    ),
    getTask: vi.fn(task(GetTaskInternalResponse, 'get', '/v1/tasks/{taskKey}')),
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
    listTaskActivity: vi.fn(
      task(ListTaskActivityInternalResponse, 'get', '/v1/tasks/{taskKey}/activity'),
    ),
    listLabels: vi.fn(task(ListLabelsInternalResponse, 'get', '/v1/labels')),
    listMyTasks: vi.fn(task(ListMyTasksInternalResponse, 'get', '/v1/me/tasks')),
    getHome: vi.fn(task(GetHomeInternalResponse, 'get', '/v1/me/home')),
  };
}

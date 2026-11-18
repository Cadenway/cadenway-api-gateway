// Compile-time check that the public and internal task core contracts still fit each other. The
// gateway relays task-service bodies without reading them (TaskServiceDocument): the client checks
// them against the internal validators and the routes against the public ones, at run time. This
// file makes a drift between the two contracts fail `pnpm typecheck` instead, as the hand-written
// models of the other routes do: every request the public validator accepts must be an input of
// the internal one, and every internal answer an input of the public one.
import type * as Lists from '@cadenway/contracts/validators/public/lists';
import type * as Spaces from '@cadenway/contracts/validators/public/spaces';
import type * as Tasks from '@cadenway/contracts/validators/public/tasks';
import type * as Internal from '@cadenway/contracts/validators/internal/task-service';
import type { z } from 'zod';

/**
 * Resolves to `true` when every `TFrom` is a `TTo`, and fails to compile otherwise.
 */
type Fits<TFrom, TTo> = [TFrom] extends [TTo] ? true : false;

/**
 * Accepts only `true`.
 */
type Holds<TCheck extends true> = TCheck;

/**
 * What the routes send: the output of each public validator is an input of the internal one.
 */
export type RequestsFit = [
  Holds<
    Fits<z.output<typeof Spaces.CreateSpaceBody>, z.input<typeof Internal.CreateSpaceInternalBody>>
  >,
  Holds<
    Fits<
      z.output<typeof Spaces.ListSpacesQueryParams>,
      z.input<typeof Internal.ListSpacesInternalQueryParams>
    >
  >,
  Holds<
    Fits<z.output<typeof Spaces.UpdateSpaceBody>, z.input<typeof Internal.UpdateSpaceInternalBody>>
  >,
  Holds<
    Fits<
      z.output<typeof Spaces.GetSpaceOverviewQueryParams>,
      z.input<typeof Internal.GetSpaceOverviewInternalQueryParams>
    >
  >,
  Holds<
    Fits<z.output<typeof Lists.CreateListBody>, z.input<typeof Internal.CreateListInternalBody>>
  >,
  Holds<
    Fits<
      z.output<typeof Lists.ListListsQueryParams>,
      z.input<typeof Internal.ListListsInternalQueryParams>
    >
  >,
  Holds<
    Fits<z.output<typeof Lists.UpdateListBody>, z.input<typeof Internal.UpdateListInternalBody>>
  >,
  Holds<
    Fits<
      z.output<typeof Lists.GetListCountsQueryParams>,
      z.input<typeof Internal.GetListCountsInternalQueryParams>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Lists.ListListActivityQueryParams>,
      z.input<typeof Internal.ListListActivityInternalQueryParams>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Tasks.ListTasksQueryParams>,
      z.input<typeof Internal.ListTasksInternalQueryParams>
    >
  >,
  Holds<
    Fits<z.output<typeof Tasks.CreateTaskBody>, z.input<typeof Internal.CreateTaskInternalBody>>
  >,
  Holds<
    Fits<
      z.output<typeof Tasks.CountTaskGroupsQueryParams>,
      z.input<typeof Internal.CountTaskGroupsInternalQueryParams>
    >
  >,
  Holds<
    Fits<z.output<typeof Tasks.UpdateTaskBody>, z.input<typeof Internal.UpdateTaskInternalBody>>
  >,
  Holds<
    Fits<
      z.output<typeof Tasks.ListSubtasksQueryParams>,
      z.input<typeof Internal.ListSubtasksInternalQueryParams>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Tasks.CreateSubtaskBody>,
      z.input<typeof Internal.CreateSubtaskInternalBody>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Tasks.AddChecklistItemBody>,
      z.input<typeof Internal.AddChecklistItemInternalBody>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Tasks.UpdateChecklistItemBody>,
      z.input<typeof Internal.UpdateChecklistItemInternalBody>
    >
  >,
  Holds<
    Fits<z.output<typeof Tasks.AddTaskLabelBody>, z.input<typeof Internal.AddTaskLabelInternalBody>>
  >,
  Holds<
    Fits<
      z.output<typeof Tasks.RemoveTaskLabelBody>,
      z.input<typeof Internal.RemoveTaskLabelInternalBody>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Tasks.ListTaskActivityQueryParams>,
      z.input<typeof Internal.ListTaskActivityInternalQueryParams>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Tasks.ListLabelsQueryParams>,
      z.input<typeof Internal.ListLabelsInternalQueryParams>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Tasks.ListMyTasksQueryParams>,
      z.input<typeof Internal.ListMyTasksInternalQueryParams>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Tasks.GetHomeQueryParams>,
      z.input<typeof Internal.GetHomeInternalQueryParams>
    >
  >,
];

/**
 * What the routes answer: the output of each internal validator is an input of the public one;
 * the detail without `partial`, which the gateway adds.
 */
export type AnswersFit = [
  Holds<
    Fits<
      z.output<typeof Internal.ListSpacesInternalResponse>,
      z.input<typeof Spaces.ListSpacesResponse>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Internal.CreateSpaceInternalResponse>,
      z.input<typeof Spaces.CreateSpaceResponse>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Internal.GetSpaceInternalResponse>,
      z.input<typeof Spaces.GetSpaceResponse>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Internal.UpdateSpaceInternalResponse>,
      z.input<typeof Spaces.UpdateSpaceResponse>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Internal.GetSpaceOverviewInternalResponse>,
      z.input<typeof Spaces.GetSpaceOverviewResponse>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Internal.CreateListInternalResponse>,
      z.input<typeof Lists.CreateListResponse>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Internal.ListListsInternalResponse>,
      z.input<typeof Lists.ListListsResponse>
    >
  >,
  Holds<
    Fits<z.output<typeof Internal.GetListInternalResponse>, z.input<typeof Lists.GetListResponse>>
  >,
  Holds<
    Fits<
      z.output<typeof Internal.UpdateListInternalResponse>,
      z.input<typeof Lists.UpdateListResponse>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Internal.GetListCountsInternalResponse>,
      z.input<typeof Lists.GetListCountsResponse>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Internal.ListListActivityInternalResponse>,
      z.input<typeof Lists.ListListActivityResponse>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Internal.ListTasksInternalResponse>,
      z.input<typeof Tasks.ListTasksResponse>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Internal.CreateTaskInternalResponse>,
      z.input<typeof Tasks.CreateTaskResponse>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Internal.CountTaskGroupsInternalResponse>,
      z.input<typeof Tasks.CountTaskGroupsResponse>
    >
  >,
  Holds<
    Fits<z.output<typeof Internal.GetTaskInternalResponse>, z.input<typeof Tasks.GetTaskResponse>>
  >,
  Holds<
    Fits<
      z.output<typeof Internal.UpdateTaskInternalResponse>,
      z.input<typeof Tasks.UpdateTaskResponse>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Internal.GetTaskDetailInternalResponse>,
      Omit<z.input<typeof Tasks.GetTaskDetailResponse>, 'partial'>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Internal.ListSubtasksInternalResponse>,
      z.input<typeof Tasks.ListSubtasksResponse>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Internal.CreateSubtaskInternalResponse>,
      z.input<typeof Tasks.CreateSubtaskResponse>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Internal.AddChecklistItemInternalResponse>,
      z.input<typeof Tasks.AddChecklistItemResponse>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Internal.UpdateChecklistItemInternalResponse>,
      z.input<typeof Tasks.UpdateChecklistItemResponse>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Internal.AssignTaskInternalResponse>,
      z.input<typeof Tasks.AssignTaskResponse>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Internal.AddTaskLabelInternalResponse>,
      z.input<typeof Tasks.AddTaskLabelResponse>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Internal.RemoveTaskLabelInternalResponse>,
      z.input<typeof Tasks.RemoveTaskLabelResponse>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Internal.ListTaskActivityInternalResponse>,
      z.input<typeof Tasks.ListTaskActivityResponse>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Internal.ListLabelsInternalResponse>,
      z.input<typeof Tasks.ListLabelsResponse>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Internal.ListMyTasksInternalResponse>,
      z.input<typeof Tasks.ListMyTasksResponse>
    >
  >,
  Holds<
    Fits<z.output<typeof Internal.GetHomeInternalResponse>, z.input<typeof Tasks.GetHomeResponse>>
  >,
];

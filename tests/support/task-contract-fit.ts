// Compile-time check that the public and internal task contracts still fit each other. The
// gateway relays task-service bodies without reading them (TaskServiceDocument): the client checks
// them against the internal validators and the routes against the public ones, at run time. This
// file makes a drift between the two contracts fail `pnpm typecheck` instead, as the hand-written
// models of the other routes do: every request body, query and relayed header the public
// validator accepts must be an input of the internal one, and every internal answer an input of
// the public one. A void answer fits only a void answer, so a body on one side alone fails too.
import type * as Access from '@cadenway/contracts/validators/public/access';
import type * as Archives from '@cadenway/contracts/validators/public/archives';
import type * as Lists from '@cadenway/contracts/validators/public/lists';
import type * as Spaces from '@cadenway/contracts/validators/public/spaces';
import type * as Tasks from '@cadenway/contracts/validators/public/tasks';
import type * as Trash from '@cadenway/contracts/validators/public/trash';
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
  Holds<
    Fits<
      z.output<typeof Access.ListSpaceGrantsQueryParams>,
      z.input<typeof Internal.ListSpaceGrantsInternalQueryParams>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Access.SetSpaceGrantBody>,
      z.input<typeof Internal.SetSpaceGrantInternalBody>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Access.ListListGrantsQueryParams>,
      z.input<typeof Internal.ListListGrantsInternalQueryParams>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Access.SetListGrantBody>,
      z.input<typeof Internal.SetListGrantInternalBody>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Access.CreateAccessRequestBody>,
      z.input<typeof Internal.CreateAccessRequestInternalBody>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Access.ListAccessRequestsQueryParams>,
      z.input<typeof Internal.ListAccessRequestsInternalQueryParams>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Access.ApproveAccessRequestBody>,
      z.input<typeof Internal.ApproveAccessRequestInternalBody>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Access.RefuseAccessRequestBody>,
      z.input<typeof Internal.RefuseAccessRequestInternalBody>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Archives.ArchiveListBody>,
      z.input<typeof Internal.ArchiveListInternalBody>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Archives.UnarchiveListBody>,
      z.input<typeof Internal.UnarchiveListInternalBody>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Archives.ArchiveTaskBody>,
      z.input<typeof Internal.ArchiveTaskInternalBody>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Archives.UnarchiveTaskBody>,
      z.input<typeof Internal.UnarchiveTaskInternalBody>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Archives.ListArchivedListsQueryParams>,
      z.input<typeof Internal.ListArchivedListsInternalQueryParams>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Archives.ListArchivedTasksQueryParams>,
      z.input<typeof Internal.ListArchivedTasksInternalQueryParams>
    >
  >,
  Holds<Fits<z.output<typeof Trash.TrashTaskBody>, z.input<typeof Internal.TrashTaskInternalBody>>>,
  Holds<
    Fits<
      z.output<typeof Trash.ListTrashQueryParams>,
      z.input<typeof Internal.ListTrashInternalQueryParams>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Trash.RestoreTrashEntryBody>,
      z.input<typeof Internal.RestoreTrashEntryInternalBody>
    >
  >,
  Holds<
    Fits<z.output<typeof Trash.EmptyTrashBody>, z.input<typeof Internal.EmptyTrashInternalBody>>
  >,
];

/**
 * What the routes relay in headers: the output of each public header validator is an input of the
 * internal one, so a precondition the internal operation requires is never optional in public.
 */
export type HeadersFit = [
  Holds<
    Fits<
      z.output<typeof Spaces.DeleteSpaceHeader>,
      z.input<typeof Internal.DeleteSpaceInternalHeader>
    >
  >,
  Holds<
    Fits<z.output<typeof Lists.DeleteListHeader>, z.input<typeof Internal.DeleteListInternalHeader>>
  >,
  Holds<
    Fits<
      z.output<typeof Access.SetSpaceGrantHeader>,
      z.input<typeof Internal.SetSpaceGrantInternalHeader>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Access.RemoveSpaceGrantHeader>,
      z.input<typeof Internal.RemoveSpaceGrantInternalHeader>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Access.SetListGrantHeader>,
      z.input<typeof Internal.SetListGrantInternalHeader>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Access.RemoveListGrantHeader>,
      z.input<typeof Internal.RemoveListGrantInternalHeader>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Archives.ArchiveListHeader>,
      z.input<typeof Internal.ArchiveListInternalHeader>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Archives.UnarchiveListHeader>,
      z.input<typeof Internal.UnarchiveListInternalHeader>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Archives.ArchiveTaskHeader>,
      z.input<typeof Internal.ArchiveTaskInternalHeader>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Archives.UnarchiveTaskHeader>,
      z.input<typeof Internal.UnarchiveTaskInternalHeader>
    >
  >,
  Holds<
    Fits<z.output<typeof Trash.TrashTaskHeader>, z.input<typeof Internal.TrashTaskInternalHeader>>
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
  Holds<
    Fits<
      z.output<typeof Internal.DeleteSpaceInternalResponse>,
      z.input<typeof Spaces.DeleteSpaceResponse>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Internal.DeleteListInternalResponse>,
      z.input<typeof Lists.DeleteListResponse>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Internal.ListSpaceGrantsInternalResponse>,
      z.input<typeof Access.ListSpaceGrantsResponse>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Internal.SetSpaceGrantInternalResponse>,
      z.input<typeof Access.SetSpaceGrantResponse>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Internal.RemoveSpaceGrantInternalResponse>,
      z.input<typeof Access.RemoveSpaceGrantResponse>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Internal.ListListGrantsInternalResponse>,
      z.input<typeof Access.ListListGrantsResponse>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Internal.SetListGrantInternalResponse>,
      z.input<typeof Access.SetListGrantResponse>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Internal.RemoveListGrantInternalResponse>,
      z.input<typeof Access.RemoveListGrantResponse>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Internal.CreateAccessRequestInternalResponse>,
      z.input<typeof Access.CreateAccessRequestResponse>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Internal.ListAccessRequestsInternalResponse>,
      z.input<typeof Access.ListAccessRequestsResponse>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Internal.ApproveAccessRequestInternalResponse>,
      z.input<typeof Access.ApproveAccessRequestResponse>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Internal.RefuseAccessRequestInternalResponse>,
      z.input<typeof Access.RefuseAccessRequestResponse>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Internal.ArchiveListInternalResponse>,
      z.input<typeof Archives.ArchiveListResponse>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Internal.UnarchiveListInternalResponse>,
      z.input<typeof Archives.UnarchiveListResponse>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Internal.ArchiveTaskInternalResponse>,
      z.input<typeof Archives.ArchiveTaskResponse>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Internal.UnarchiveTaskInternalResponse>,
      z.input<typeof Archives.UnarchiveTaskResponse>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Internal.ListArchivedListsInternalResponse>,
      z.input<typeof Archives.ListArchivedListsResponse>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Internal.ListArchivedTasksInternalResponse>,
      z.input<typeof Archives.ListArchivedTasksResponse>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Internal.TrashTaskInternalResponse>,
      z.input<typeof Trash.TrashTaskResponse>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Internal.ListTrashInternalResponse>,
      z.input<typeof Trash.ListTrashResponse>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Internal.PurgeTrashEntryInternalResponse>,
      z.input<typeof Trash.PurgeTrashEntryResponse>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Internal.RestoreTrashEntryInternalResponse>,
      z.input<typeof Trash.RestoreTrashEntryResponse>
    >
  >,
  Holds<
    Fits<
      z.output<typeof Internal.EmptyTrashInternalResponse>,
      z.input<typeof Trash.EmptyTrashResponse>
    >
  >,
];

import * as schemas from '@cadenway/contracts/validators/internal/notification-service';
import type { InternalHttpClient, InternalRequestInit } from '@cadenway/nest-common';
import type { z } from 'zod';

import {
  answered,
  expectBody,
  expectStatus,
  outsideContract,
  type GeneratedResponse,
} from '../problems/upstream-answer.js';
import { getNotificationServiceInternalRoutes } from './generated/notification-service.js';

/** The service named in internal token audiences and upstream errors. */
export const NOTIFICATION_SERVICE: string = 'notification-service';

type Routes = ReturnType<typeof getNotificationServiceInternalRoutes>;
type Response = GeneratedResponse & { readonly headers: Headers };

/** Technical client for the private Notification contract. */
export class NotificationServiceClient {
  // #region Properties
  /** Generated paths backed by the shared signed transport. */
  private readonly routes: Routes;
  // #endregion

  // #region Constructor
  /** Binds the signed service transport. */
  public constructor(http: InternalHttpClient) {
    this.routes = getNotificationServiceInternalRoutes((input, init) => {
      if (typeof input !== 'string') throw new Error('The Notification client requires a path.');
      return http.fetch(input, init);
    });
  }
  // #endregion

  // #region Methods
  /** Reads account-global notification preferences. */
  public async getNotificationPreferences(): Promise<
    z.output<typeof schemas.GetNotificationPreferencesInternalResponse>
  > {
    return this.versioned(
      'getNotificationPreferencesInternal',
      this.routes.getNotificationPreferencesInternal(),
      schemas.GetNotificationPreferencesInternalResponse,
    );
  }

  /** Updates account-global notification preferences with an optional precondition. */
  public async updateNotificationPreferences(
    patch: z.input<typeof schemas.UpdateNotificationPreferencesInternalBody>,
    ifMatch?: string,
  ): Promise<z.output<typeof schemas.UpdateNotificationPreferencesInternalResponse>> {
    const body = schemas.UpdateNotificationPreferencesInternalBody.parse(patch);
    return this.versioned(
      'updateNotificationPreferencesInternal',
      this.routes.updateNotificationPreferencesInternal(body, this.options(ifMatch)),
      schemas.UpdateNotificationPreferencesInternalResponse,
    );
  }

  /** Reads a bounded private candidate page for subsequent Task authorization. */
  public async listInboxNotifications(
    params: z.input<typeof schemas.ListInboxNotificationsInternalQueryParams>,
    signal?: AbortSignal,
  ): Promise<z.output<typeof schemas.ListInboxNotificationsInternalResponse>> {
    return this.body(
      'listInboxNotificationsInternal',
      this.routes.listInboxNotificationsInternal(
        schemas.ListInboxNotificationsInternalQueryParams.parse(params),
        this.options(undefined, signal),
      ),
      schemas.ListInboxNotificationsInternalResponse,
    );
  }

  /** Reads subject weights and their owner generation. */
  public async listInboxUnreadSubjects(
    params: z.input<typeof schemas.ListInboxUnreadSubjectsInternalQueryParams>,
    signal?: AbortSignal,
  ): Promise<z.output<typeof schemas.ListInboxUnreadSubjectsInternalResponse>> {
    return this.body(
      'listInboxUnreadSubjectsInternal',
      this.routes.listInboxUnreadSubjectsInternal(
        schemas.ListInboxUnreadSubjectsInternalQueryParams.parse(params),
        this.options(undefined, signal),
      ),
      schemas.ListInboxUnreadSubjectsInternalResponse,
    );
  }

  /** Marks the authorized subject selection through the fixed creation cutoff. */
  public async markInboxNotificationsRead(
    selection: z.input<typeof schemas.MarkInboxNotificationsReadInternalBody>,
    signal?: AbortSignal,
  ): Promise<z.output<typeof schemas.MarkInboxNotificationsReadInternalResponse>> {
    return this.body(
      'markInboxNotificationsReadInternal',
      this.routes.markInboxNotificationsReadInternal(
        schemas.MarkInboxNotificationsReadInternalBody.parse(selection),
        this.options(undefined, signal),
      ),
      schemas.MarkInboxNotificationsReadInternalResponse,
    );
  }

  /** Reads an inbox record's private authorization candidate. */
  public async getInboxNotificationCandidate(
    id: string,
  ): Promise<z.output<typeof schemas.GetInboxNotificationCandidateInternalResponse>> {
    return this.body(
      'getInboxNotificationCandidateInternal',
      this.routes.getInboxNotificationCandidateInternal(id, this.options()),
      schemas.GetInboxNotificationCandidateInternalResponse,
    );
  }

  /** Marks one checked subject as read. */
  public async markInboxNotificationRead(
    id: string,
    binding: z.input<typeof schemas.MarkInboxNotificationReadInternalBody>,
    ifMatch?: string,
  ): Promise<z.output<typeof schemas.MarkInboxNotificationReadInternalResponse>> {
    return this.versioned(
      'markInboxNotificationReadInternal',
      this.routes.markInboxNotificationReadInternal(
        id,
        schemas.MarkInboxNotificationReadInternalBody.parse(binding),
        this.options(ifMatch),
      ),
      schemas.MarkInboxNotificationReadInternalResponse,
    );
  }

  /** Archives one checked subject. */
  public async archiveInboxNotification(
    id: string,
    binding: z.input<typeof schemas.ArchiveInboxNotificationInternalBody>,
    ifMatch?: string,
  ): Promise<z.output<typeof schemas.ArchiveInboxNotificationInternalResponse>> {
    return this.versioned(
      'archiveInboxNotificationInternal',
      this.routes.archiveInboxNotificationInternal(
        id,
        schemas.ArchiveInboxNotificationInternalBody.parse(binding),
        this.options(ifMatch),
      ),
      schemas.ArchiveInboxNotificationInternalResponse,
    );
  }

  /** Reads a generation-bound private reminder candidate page. */
  public async listReminders(
    params: z.input<typeof schemas.ListRemindersInternalQueryParams>,
    signal?: AbortSignal,
  ): Promise<z.output<typeof schemas.ListRemindersInternalResponse>> {
    return this.body(
      'listRemindersInternal',
      this.routes.listRemindersInternal(
        schemas.ListRemindersInternalQueryParams.parse(params),
        this.options(undefined, signal),
      ),
      schemas.ListRemindersInternalResponse,
    );
  }

  /** Reads a selection after the gateway has checked each task. */
  public async listVisibleReminderRecords(
    selection: z.input<typeof schemas.ListVisibleReminderRecordsInternalBody>,
    signal?: AbortSignal,
  ): Promise<z.output<typeof schemas.ListVisibleReminderRecordsInternalResponse>> {
    const request = schemas.ListVisibleReminderRecordsInternalBody.parse(selection);
    const result = await this.body(
      'listVisibleReminderRecordsInternal',
      this.routes.listVisibleReminderRecordsInternal(request, this.options(undefined, signal)),
      schemas.ListVisibleReminderRecordsInternalResponse,
    );
    let next = 0;
    for (const item of result.items) {
      const position = request.items.findIndex(
        (candidate, index) =>
          index >= next &&
          candidate.id.toLowerCase() === item.id.toLowerCase() &&
          candidate.taskId.toLowerCase() === item.taskId.toLowerCase(),
      );
      if (position < 0) {
        throw outsideContract(
          NOTIFICATION_SERVICE,
          'listVisibleReminderRecordsInternal',
          'unexpected or reordered reminder',
        );
      }
      next = position + 1;
    }
    return result;
  }

  /** Reads the pending reminder linked to an authorized task UUID. */
  public async getTaskReminder(
    taskId: string,
  ): Promise<z.output<typeof schemas.GetTaskReminderInternalResponse>> {
    const reminder = await this.versioned(
      'getTaskReminderInternal',
      this.routes.getTaskReminderInternal(taskId, this.options()),
      schemas.GetTaskReminderInternalResponse,
    );
    return this.checkedReminder('getTaskReminderInternal', reminder, taskId);
  }

  /** Creates or reschedules a reminder for an authorized task UUID. */
  public async setTaskReminder(
    taskId: string,
    schedule: z.input<typeof schemas.SetTaskReminderInternalBody>,
    ifMatch?: string,
  ): Promise<{
    readonly reminder: z.output<typeof schemas.SetTaskReminderInternalResponse>;
    readonly created: boolean;
  }> {
    const operation = 'setTaskReminderInternal';
    const response = await answered(
      NOTIFICATION_SERVICE,
      operation,
      this.routes.setTaskReminderInternal(
        taskId,
        schemas.SetTaskReminderInternalBody.parse(schedule),
        this.options(ifMatch),
      ),
    );
    if (response.status !== 200 && response.status !== 201)
      throw outsideContract(NOTIFICATION_SERVICE, operation, 'unexpected status');
    const reminder = this.checkedVersion(
      operation,
      response,
      schemas.SetTaskReminderInternalResponse,
      response.status,
    );
    this.checkedReminder(operation, reminder, taskId);
    if (
      response.status === 201 &&
      response.headers.get('Location') !== `/internal/v1/reminders/${reminder.id}`
    ) {
      throw outsideContract(NOTIFICATION_SERVICE, operation, 'missing or inconsistent Location');
    }
    return { reminder, created: response.status === 201 };
  }

  /** Reads a reminder's private task linkage before current authorization. */
  public async getReminderCandidate(
    id: string,
  ): Promise<z.output<typeof schemas.GetReminderCandidateInternalResponse>> {
    return this.body(
      'getReminderCandidateInternal',
      this.routes.getReminderCandidateInternal(id, this.options()),
      schemas.GetReminderCandidateInternalResponse,
    );
  }

  /** Reads a reminder bound to the checked task UUID. */
  public async getReminder(
    id: string,
    taskId: string,
  ): Promise<z.output<typeof schemas.GetReminderInternalResponse>> {
    const reminder = await this.versioned(
      'getReminderInternal',
      this.routes.getReminderInternal(id, { authorizedTaskId: taskId }, this.options()),
      schemas.GetReminderInternalResponse,
    );
    return this.checkedReminder('getReminderInternal', reminder, taskId, id);
  }

  /** Updates a reminder note after its Task authorization. */
  public async updateReminderNote(
    id: string,
    taskId: string,
    patch: z.input<typeof schemas.UpdateReminderNoteInternalBody>,
    ifMatch?: string,
  ): Promise<z.output<typeof schemas.UpdateReminderNoteInternalResponse>> {
    const reminder = await this.versioned(
      'updateReminderNoteInternal',
      this.routes.updateReminderNoteInternal(
        id,
        schemas.UpdateReminderNoteInternalBody.parse(patch),
        { authorizedTaskId: taskId },
        this.options(ifMatch),
      ),
      schemas.UpdateReminderNoteInternalResponse,
    );
    return this.checkedReminder('updateReminderNoteInternal', reminder, taskId, id);
  }

  /** Deletes a reminder bound to the checked task. */
  public async deleteReminder(id: string, taskId: string, ifMatch?: string): Promise<void> {
    const operation = 'deleteReminderInternal';
    const response = await answered(
      NOTIFICATION_SERVICE,
      operation,
      this.routes.deleteReminderInternal(id, { authorizedTaskId: taskId }, this.options(ifMatch)),
    );
    expectStatus(NOTIFICATION_SERVICE, operation, response, 204);
  }

  /** Reschedules a reminder bound to the checked task. */
  public async snoozeReminder(
    id: string,
    taskId: string,
    schedule: z.input<typeof schemas.SnoozeReminderInternalBody>,
    ifMatch?: string,
  ): Promise<z.output<typeof schemas.SnoozeReminderInternalResponse>> {
    const reminder = await this.versioned(
      'snoozeReminderInternal',
      this.routes.snoozeReminderInternal(
        id,
        schemas.SnoozeReminderInternalBody.parse(schedule),
        { authorizedTaskId: taskId },
        this.options(ifMatch),
      ),
      schemas.SnoozeReminderInternalResponse,
    );
    return this.checkedReminder('snoozeReminderInternal', reminder, taskId, id);
  }

  /** Completes a reminder bound to the checked task. */
  public async completeReminder(
    id: string,
    taskId: string,
    ifMatch?: string,
  ): Promise<z.output<typeof schemas.CompleteReminderInternalResponse>> {
    const reminder = await this.versioned(
      'completeReminderInternal',
      this.routes.completeReminderInternal(id, { authorizedTaskId: taskId }, this.options(ifMatch)),
      schemas.CompleteReminderInternalResponse,
    );
    return this.checkedReminder('completeReminderInternal', reminder, taskId, id);
  }

  /** Prevents a checked Task decision being reused by an automatic transport retry. */
  private options(ifMatch?: string, signal?: AbortSignal): InternalRequestInit {
    return {
      idempotent: false,
      ...(signal === undefined ? {} : { signal }),
      ...(ifMatch === undefined ? {} : { headers: { 'If-Match': ifMatch } }),
    };
  }

  /** Ensures the private record belongs to the task just authorized by the gateway. */
  private checkedReminder<T extends { readonly id: string; readonly taskId: string }>(
    operation: string,
    reminder: T,
    taskId: string,
    id?: string,
  ): T {
    if (
      reminder.taskId.toLowerCase() !== taskId.toLowerCase() ||
      (id !== undefined && reminder.id.toLowerCase() !== id.toLowerCase())
    ) {
      throw outsideContract(NOTIFICATION_SERVICE, operation, 'mismatched reminder linkage');
    }
    return reminder;
  }

  /** Validates a successful private response. */
  private async body<T extends z.ZodType>(
    operation: string,
    pending: Promise<Response>,
    schema: T,
  ): Promise<z.output<T>> {
    return expectBody(
      NOTIFICATION_SERVICE,
      operation,
      await answered(NOTIFICATION_SERVICE, operation, pending),
      200,
      schema,
    );
  }

  /** Validates a versioned private response and its required ETag. */
  private async versioned<T extends z.ZodType<{ version: number }>>(
    operation: string,
    pending: Promise<Response>,
    schema: T,
  ): Promise<z.output<T>> {
    const response = await answered(NOTIFICATION_SERVICE, operation, pending);
    return this.checkedVersion(operation, response, schema, 200);
  }

  /** Requires the strong ETag to identify the response's actual version. */
  private checkedVersion<T extends z.ZodType<{ version: number }>>(
    operation: string,
    response: Response,
    schema: T,
    status: number,
  ): z.output<T> {
    const body = expectBody(NOTIFICATION_SERVICE, operation, response, status, schema);
    if (response.headers.get('ETag') !== `"${String(body.version)}"`) {
      throw outsideContract(NOTIFICATION_SERVICE, operation, 'missing or inconsistent ETag');
    }
    return body;
  }
  // #endregion
}

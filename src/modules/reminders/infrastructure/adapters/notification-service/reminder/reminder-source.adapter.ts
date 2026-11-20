import type { NotificationServiceClient } from '../../../../../../clients/notification-service.client.js';
import { ProblemException } from '@cadenway/nest-common';
import type { ReminderListSource } from '../../../../application/ports/outbound/notification-service/reminder/reminder-list-source.port.js';
import type { ReminderOperations } from '../../../../application/ports/outbound/notification-service/reminder/reminder-operations.port.js';

/** Binds owner-scoped reminder operations to the generated Notification client. */
export function reminderOperations(client: NotificationServiceClient): ReminderOperations {
  return {
    candidate: (id) => client.getReminderCandidate(id),
    getTask: (taskId) => client.getTaskReminder(taskId),
    setTask: (taskId, schedule, ifMatch) => client.setTaskReminder(taskId, schedule, ifMatch),
    get: (id, taskId) => client.getReminder(id, taskId),
    update: (id, taskId, patch, ifMatch) => client.updateReminderNote(id, taskId, patch, ifMatch),
    remove: (id, taskId, ifMatch) => client.deleteReminder(id, taskId, ifMatch),
    snooze: (id, taskId, schedule, ifMatch) => client.snoozeReminder(id, taskId, schedule, ifMatch),
    complete: (id, taskId, ifMatch) => client.completeReminder(id, taskId, ifMatch),
  };
}

/** Translates only the scan-generation conflict into a request to restart the scan. */
export function reminderListSource(client: NotificationServiceClient): ReminderListSource {
  return {
    page: async (query, signal) => {
      signal.throwIfAborted();
      try {
        return await client.listReminders(query, signal);
      } catch (error) {
        if (
          error instanceof ProblemException &&
          error.problem.status === 409 &&
          error.problem.code === 'reminder.generation-changed'
        )
          return null;
        throw error;
      }
    },
    selected: async (snapshotGeneration, items, signal) => {
      signal.throwIfAborted();
      try {
        return (
          await client.listVisibleReminderRecords({ snapshotGeneration, items: [...items] }, signal)
        ).items;
      } catch (error) {
        if (
          error instanceof ProblemException &&
          error.problem.status === 409 &&
          error.problem.code === 'reminder.generation-changed'
        )
          return null;
        throw error;
      }
    },
  };
}

import type { TaskServiceClient } from '../../../../../../clients/task-service.client.js';
import type { ReminderTaskDirectory } from '../../../../application/ports/outbound/task-service/reminder/reminder-task-directory.port.js';

/** Uses one current Task access snapshot for each lookup. */
export function reminderTaskDirectory(client: TaskServiceClient): ReminderTaskDirectory {
  return {
    lookup: async (taskIds, includeDisplay, signal) => {
      signal.throwIfAborted();
      const subjects = taskIds.map((taskId) => ({
        subject: { kind: 'task-id' as const, taskId },
        ...(includeDisplay ? { display: {} } : {}),
      }));
      return (await client.resolveNotificationSubjects({ subjects }, signal)).results;
    },
  };
}

/** Resolves a task key, with display, under the current authenticated user. */
export async function reminderTaskByKey(
  client: TaskServiceClient,
  taskKey: string,
): Promise<{ taskId: string; taskKey: string; taskName: string } | null> {
  const answer = await client.resolveNotificationSubjects({
    subjects: [{ subject: { kind: 'task-key', taskKey }, display: {} }],
  });
  const decision = answer.results[0];
  return decision?.visible === true ? (decision.display ?? null) : null;
}

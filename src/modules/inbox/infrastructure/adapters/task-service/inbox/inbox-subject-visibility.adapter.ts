import type { TaskServiceClient } from '../../../../../../clients/task-service.client.js';
import type { InboxSubjectVisibility } from '../../../../application/ports/outbound/task-service/inbox/inbox-subject-visibility.port.js';

/** Uses Task's current owner-scoped subject check. */
export function inboxSubjectVisibility(client: TaskServiceClient): InboxSubjectVisibility {
  return {
    resolve: async (subjects, signal) => {
      signal.throwIfAborted();
      const result = await client.resolveNotificationSubjects({ subjects: [...subjects] }, signal);
      signal.throwIfAborted();
      return result.results;
    },
  };
}

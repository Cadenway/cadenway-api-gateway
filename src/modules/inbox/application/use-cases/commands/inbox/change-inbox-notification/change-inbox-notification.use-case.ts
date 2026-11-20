import type { InboxNotification } from '../../../../models/inbox/inbox-notification.model.js';
import { InboxNotFound } from '../../../../models/inbox/inbox-not-found.model.js';
import { InboxUnavailable } from '../../../../models/inbox/inbox-unavailable.model.js';
import { withInboxBudget } from '../../../../models/inbox/inbox-work-budget.model.js';
import type { InboxNotificationCommand } from '../../../../ports/outbound/notification-service/inbox/inbox-notification-command.port.js';
import type { InboxActorNames } from '../../../../ports/outbound/organization-service/inbox/inbox-actor-names.port.js';
import type { InboxSubjectVisibility } from '../../../../ports/outbound/task-service/inbox/inbox-subject-visibility.port.js';

/** Changes one owned notification after its exact subject has been checked. */
export class ChangeInboxNotification {
  // #region Constructor
  /** Binds checked owner mutations and current subject enrichment. */
  public constructor(
    private readonly source: InboxNotificationCommand,
    private readonly visibility: InboxSubjectVisibility,
    private readonly names: InboxActorNames,
  ) {}
  // #endregion

  // #region Methods
  /** Rechecks visibility before mutation and before returning display fields. */
  public execute(
    id: string,
    action: 'read' | 'archive',
    ifMatch: string | undefined,
  ): Promise<InboxNotification> {
    return withInboxBudget(async (signal) => {
      const candidate = await this.source.candidate(id);
      if (candidate.id.toLowerCase() !== id.toLowerCase())
        throw new InboxUnavailable('notification-service');
      if (candidate.subject !== null) {
        const [decision] = await this.visibility.resolve([{ subject: candidate.subject }], signal);
        if (decision === undefined) throw new InboxUnavailable('task-service');
        if (!decision.visible) throw new InboxNotFound();
      }
      signal.throwIfAborted();
      const changed = await this.source.change(id, candidate.subject, action, ifMatch);
      if (
        changed.id.toLowerCase() !== id.toLowerCase() ||
        JSON.stringify(changed.subject) !== JSON.stringify(candidate.subject)
      ) {
        throw new InboxUnavailable('notification-service');
      }
      const subject = changed.subject;
      let display:
        | {
            readonly taskId: string;
            readonly taskKey: string;
            readonly taskName: string;
            readonly commentExcerpt?: string | null;
          }
        | undefined;
      if (subject !== null) {
        const task = subject.kind === 'task-id' || subject.kind === 'task-key';
        const [decision] = await this.visibility.resolve(
          [
            task
              ? {
                  subject,
                  display: changed.commentId === undefined ? {} : { commentId: changed.commentId },
                }
              : { subject },
          ],
          signal,
        );
        if (decision === undefined) throw new InboxUnavailable('task-service');
        if (!decision.visible) throw new InboxNotFound();
        display = decision.display;
        if (
          (task && display === undefined) ||
          (!task && display !== undefined) ||
          (subject.kind === 'task-id' &&
            display?.taskId.toLowerCase() !== subject.taskId.toLowerCase()) ||
          (subject.kind === 'task-key' && display?.taskKey !== subject.taskKey) ||
          (task && (changed.commentId === undefined) !== (display?.commentExcerpt === undefined))
        )
          throw new InboxUnavailable('task-service');
      }
      const userId = subject === null ? undefined : changed.actorUserId?.toLowerCase();
      const actor =
        userId === undefined
          ? undefined
          : (await this.names.lookup([userId], signal)).items.find(
              (item) => item.userId.toLowerCase() === userId,
            );
      return {
        id: changed.id,
        kind: changed.kind,
        actor: actor === undefined ? null : { userId: actor.userId, name: actor.name },
        task: display === undefined ? null : { taskKey: display.taskKey, name: display.taskName },
        excerpt: display?.commentExcerpt ?? null,
        status: display === undefined ? null : (changed.status ?? null),
        createdAt: changed.createdAt,
        readAt: changed.readAt,
        archivedAt: changed.archivedAt,
        version: changed.version,
      };
    });
  }
  // #endregion
}

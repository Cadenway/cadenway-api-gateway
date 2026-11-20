import type { ReminderOperations } from '../../../../ports/outbound/notification-service/reminder/reminder-operations.port.js';
import type { ReminderRecord } from '../../../../models/reminder/reminder-record.model.js';
import type { PublicReminder } from '../../../../models/reminder/public-reminder.model.js';
import { ReminderTargetNotFound } from '../../../../models/reminder/reminder-target-not-found.model.js';
import type { ReminderTaskDirectory } from '../../../../ports/outbound/task-service/reminder/reminder-task-directory.port.js';

/** Applies current Task visibility before a private reminder read or mutation. */
export class AccessReminder {
  // #region Constructor
  /** Binds checked Task access to private Notification operations. */
  public constructor(
    private readonly reminders: ReminderOperations,
    private readonly tasks: ReminderTaskDirectory,
    private readonly lookupKey: (key: string) => Promise<{
      readonly taskId: string;
      readonly taskKey: string;
      readonly taskName: string;
    } | null>,
  ) {}
  // #endregion

  // #region Methods
  /** Selects a checked read or mutation. */
  public execute(action: 'getTask' | 'get', id: string): Promise<PublicReminder>;
  public execute(
    action: 'setTask',
    id: string,
    body: { remindAt: string; note?: string | null },
    ifMatch?: string,
  ): Promise<{ readonly reminder: PublicReminder; readonly created: boolean }>;
  public execute(
    action: 'update',
    id: string,
    body: { note: string | null },
    ifMatch?: string,
  ): Promise<PublicReminder>;
  public execute(action: 'remove', id: string, body: undefined, ifMatch?: string): Promise<void>;
  public execute(
    action: 'snooze',
    id: string,
    body: { remindAt: string },
    ifMatch?: string,
  ): Promise<PublicReminder>;
  public execute(
    action: 'complete',
    id: string,
    body: undefined,
    ifMatch?: string,
  ): Promise<PublicReminder>;
  public execute(
    action: 'getTask' | 'setTask' | 'get' | 'update' | 'remove' | 'snooze' | 'complete',
    id: string,
    body?: { remindAt?: string; note?: string | null },
    ifMatch?: string,
  ): Promise<
    PublicReminder | { readonly reminder: PublicReminder; readonly created: boolean } | void
  > {
    switch (action) {
      case 'getTask':
        return this.getTask(id);
      case 'get':
        return this.get(id);
      case 'remove':
        return this.remove(id, ifMatch);
      case 'complete':
        return this.complete(id, ifMatch);
      case 'setTask':
        if (body?.remindAt === undefined) throw new Error('Missing reminder schedule.');
        return this.setTask(
          id,
          { remindAt: body.remindAt, ...(body.note === undefined ? {} : { note: body.note }) },
          ifMatch,
        );
      case 'snooze':
        if (body?.remindAt === undefined) throw new Error('Missing reminder schedule.');
        return this.snooze(id, { remindAt: body.remindAt }, ifMatch);
      case 'update':
        if (body?.note === undefined) throw new Error('Missing reminder note.');
        return this.update(id, { note: body.note }, ifMatch);
    }
  }

  /** Checks an owner-bound reminder and returns its current task display. */
  public async byId(id: string): Promise<{ taskId: string; taskKey: string; taskName: string }> {
    const candidate = await this.reminders.candidate(id);
    if (candidate.id !== id) throw new Error('Invalid reminder candidate.');
    return this.visible(candidate.taskId, 'reminder.not-found');
  }

  /** Resolves one task key through the Task directory. */
  public async byKey(key: string): Promise<{ taskId: string; taskKey: string; taskName: string }> {
    const task = await this.lookupKey(key);
    if (task === null) throw new ReminderTargetNotFound('task.not-found');
    return task;
  }

  public async getTask(key: string): Promise<PublicReminder> {
    const task = await this.byKey(key);
    return this.project(await this.reminders.getTask(task.taskId), task);
  }

  public async setTask(
    key: string,
    schedule: { remindAt: string; note?: string | null },
    ifMatch?: string,
  ): Promise<{ readonly reminder: PublicReminder; readonly created: boolean }> {
    const task = await this.byKey(key);
    const result = await this.reminders.setTask(task.taskId, schedule, ifMatch);
    return { reminder: this.project(result.reminder, task), created: result.created };
  }

  public async get(id: string): Promise<PublicReminder> {
    const task = await this.byId(id);
    return this.project(await this.reminders.get(id, task.taskId), task);
  }

  public async update(
    id: string,
    patch: { note: string | null },
    ifMatch?: string,
  ): Promise<PublicReminder> {
    const task = await this.byId(id);
    return this.project(await this.reminders.update(id, task.taskId, patch, ifMatch), task);
  }

  public async remove(id: string, ifMatch?: string): Promise<void> {
    const task = await this.byId(id);
    await this.reminders.remove(id, task.taskId, ifMatch);
  }

  public async snooze(
    id: string,
    schedule: { remindAt: string },
    ifMatch?: string,
  ): Promise<PublicReminder> {
    const task = await this.byId(id);
    return this.project(await this.reminders.snooze(id, task.taskId, schedule, ifMatch), task);
  }

  public async complete(id: string, ifMatch?: string): Promise<PublicReminder> {
    const task = await this.byId(id);
    return this.project(await this.reminders.complete(id, task.taskId, ifMatch), task);
  }

  /** Combines an authorized task with its owner-bound reminder. */
  public project(
    record: ReminderRecord,
    task: { taskKey: string; taskName: string },
  ): PublicReminder {
    return {
      id: record.id,
      taskKey: task.taskKey,
      taskName: task.taskName,
      remindAt: record.remindAt,
      note: record.note,
      firedAt: record.firedAt,
      completedAt: record.completedAt,
      version: record.version,
    };
  }

  private async visible(taskId: string, code: 'reminder.not-found') {
    const [decision] = await this.tasks.lookup([taskId], true, new AbortController().signal);
    if (decision?.visible !== true || decision.display === undefined) {
      throw new ReminderTargetNotFound(code);
    }
    return decision.display;
  }
  // #endregion
}

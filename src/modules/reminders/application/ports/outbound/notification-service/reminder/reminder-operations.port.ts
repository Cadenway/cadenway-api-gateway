import type { ReminderRecord } from '../../../../models/reminder/reminder-record.model.js';

/** Owner-scoped Reminder operations. The task identity is verified before each call. */
export interface ReminderOperations {
  // #region Methods
  /** Reads the private task linkage for the exact requested reminder. */
  candidate(id: string): Promise<{ readonly id: string; readonly taskId: string }>;
  getTask(taskId: string): Promise<ReminderRecord>;
  setTask(
    taskId: string,
    schedule: { remindAt: string; note?: string | null },
    ifMatch?: string,
  ): Promise<{ readonly reminder: ReminderRecord; readonly created: boolean }>;
  get(id: string, taskId: string): Promise<ReminderRecord>;
  update(
    id: string,
    taskId: string,
    patch: { note: string | null },
    ifMatch?: string,
  ): Promise<ReminderRecord>;
  remove(id: string, taskId: string, ifMatch?: string): Promise<void>;
  snooze(
    id: string,
    taskId: string,
    schedule: { remindAt: string },
    ifMatch?: string,
  ): Promise<ReminderRecord>;
  complete(id: string, taskId: string, ifMatch?: string): Promise<ReminderRecord>;
  // #endregion
}

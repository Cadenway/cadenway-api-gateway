/** Exact resource selector stored by Notification and checked by Task. */
export type InboxSubject =
  | { readonly kind: 'task-id'; readonly taskId: string }
  | { readonly kind: 'task-key'; readonly taskKey: string }
  | { readonly kind: 'list'; readonly listId: string }
  | { readonly kind: 'space'; readonly spaceId: string };

/** Task's position-aligned visibility decision and approved display, if requested. */
export type InboxVisibilityDecision =
  | { readonly visible: false }
  | {
      readonly visible: true;
      readonly display?: {
        readonly taskId: string;
        readonly taskKey: string;
        readonly taskName: string;
        readonly commentExcerpt?: string | null;
      };
    };

import type { ListTaskExportRow } from './list-task-export-row.model.js';

/** Validated records from the task service's authorized CSV projection. */
export type ListTaskExportFrame =
  | { readonly kind: 'metadata'; readonly filename: string; readonly header: string }
  | { readonly kind: 'row'; readonly row: ListTaskExportRow }
  | { readonly kind: 'complete'; readonly rowCount: number };

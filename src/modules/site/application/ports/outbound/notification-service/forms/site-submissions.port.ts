import type { SiteForm } from '../../../../models/forms/site-form.model.js';

/** Forwards validated public form submissions to their owning service. */
export interface SiteSubmissions {
  // #region Properties
  /** Accepts a contact request with its original retry key. */
  readonly contact: (
    body: Extract<SiteForm, { kind: 'contact' }>['body'],
    key: string,
  ) => Promise<void>;

  /** Records a newsletter signup. */
  readonly newsletter: (body: Extract<SiteForm, { kind: 'newsletter' }>['body']) => Promise<void>;
  // #endregion
}

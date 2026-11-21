import type { SiteForm } from '../../../../models/forms/site-form.model.js';
import type { SiteSubmissions } from '../../../../ports/outbound/notification-service/forms/site-submissions.port.js';

/** Relays public site forms to Notification. */
export class SubmitSiteForm {
  // #region Constructor
  /** Binds the Notification-owned submission port. */
  public constructor(private readonly submissions: SiteSubmissions) {}
  // #endregion

  // #region Methods
  /** Forwards the selected form, keeping the contact retry key unchanged. */
  public execute(input: SiteForm): Promise<void> {
    return input.kind === 'contact'
      ? this.submissions.contact(input.body, input.key)
      : this.submissions.newsletter(input.body);
  }
  // #endregion
}

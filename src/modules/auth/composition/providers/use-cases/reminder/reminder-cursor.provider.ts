import { CONFIG } from '@cadenway/nest-common';
import type { FactoryProvider } from '@nestjs/common';
import { createPrivateKey } from 'node:crypto';

import type { AppConfig } from '../../../../../../config/app-config.js';
import { ReminderCursor } from '../../../../application/use-cases/queries/reminder/reminder-cursor/reminder-cursor.use-case.js';
import { Ed25519ReminderCursor } from '../../../../infrastructure/adapters/crypto/ed25519-reminder-cursor.adapter.js';

/** Binds the reminders cursor separately to the configured gateway signing identity. */
export const reminderCursorProvider: FactoryProvider<ReminderCursor> = {
  provide: ReminderCursor,
  inject: [CONFIG],
  useFactory: (config: Pick<AppConfig, 'INTERNAL_TOKEN_PRIVATE_JWK'>): ReminderCursor => {
    const signingKey = createPrivateKey({
      key: { ...config.INTERNAL_TOKEN_PRIVATE_JWK },
      format: 'jwk',
    });
    return new ReminderCursor(new Ed25519ReminderCursor(signingKey));
  },
};

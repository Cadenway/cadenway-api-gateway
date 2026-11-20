import { CONFIG } from '@cadenway/nest-common';
import type { FactoryProvider } from '@nestjs/common';
import { createPrivateKey } from 'node:crypto';

import type { AppConfig } from '../../../../../../config/app-config.js';
import { SprintReportCursor } from '../../../../application/use-cases/queries/reporting/sprint-report-cursor/sprint-report-cursor.use-case.js';
import { Ed25519SprintReportCursor } from '../../../../infrastructure/adapters/crypto/ed25519-sprint-report-cursor.adapter.js';

/** Imports the gateway key once for the scoped Sprint report cursor provider. */
export const sprintReportCursorProvider: FactoryProvider<SprintReportCursor> = {
  provide: SprintReportCursor,
  inject: [CONFIG],
  useFactory: (config: Pick<AppConfig, 'INTERNAL_TOKEN_PRIVATE_JWK'>): SprintReportCursor => {
    const signingKey = createPrivateKey({
      key: { ...config.INTERNAL_TOKEN_PRIVATE_JWK },
      format: 'jwk',
    });
    return new SprintReportCursor(new Ed25519SprintReportCursor(signingKey));
  },
};

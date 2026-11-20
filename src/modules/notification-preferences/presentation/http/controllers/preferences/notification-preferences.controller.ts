import {
  GetNotificationPreferencesResponse,
  UpdateNotificationPreferencesBody,
  UpdateNotificationPreferencesResponse,
} from '@cadenway/contracts/validators/public/inbox';
import { formatEtag, ProblemException } from '@cadenway/nest-common';
import { Controller, Get, Inject, Patch, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { z } from 'zod';

import { conformBody } from '../../../../../../problems/upstream-answer.js';
import {
  toPublicProblem,
  type AcceptedProblems,
} from '../../../../../../problems/upstream-problem.js';
import { IfMatchHeader } from '../../../../../../presentation/http/mappers/request-headers.mapper.js';
import { RequiredBody } from '../../../../../../presentation/http/mappers/request-body.mapper.js';
import { CredentialGuard } from '../../../../../auth/public/credential/credential-guard.js';
import { RateLimitGuard } from '../../../../../rate-limit/public/requests/rate-limit-guard.js';
import { UpdateNotificationPreferences } from '../../../../application/use-cases/commands/preferences/update-notification-preferences/update-notification-preferences.use-case.js';
import { GetNotificationPreferences } from '../../../../application/use-cases/queries/preferences/get-notification-preferences/get-notification-preferences.use-case.js';

const ACCEPTED: AcceptedProblems = {
  400: ['request.invalid'],
  412: ['request.version-mismatch'],
};

/** Session-scoped account notification preferences. */
@Controller('v1/me/notification-preferences')
@UseGuards(CredentialGuard, RateLimitGuard)
export class NotificationPreferencesController {
  // #region Constructor
  /** Binds the account preference use cases. */
  public constructor(
    @Inject(GetNotificationPreferences) private readonly getPreferences: GetNotificationPreferences,
    @Inject(UpdateNotificationPreferences)
    private readonly updatePreferences: UpdateNotificationPreferences,
  ) {}
  // #endregion

  // #region Methods
  /** Reads the account preferences independently of a selected organization. */
  @Get()
  @CredentialGuard.requires({
    operationId: 'getNotificationPreferences',
    security: [{ sessionCookie: [] }],
    organization: false,
  })
  public async get(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof GetNotificationPreferencesResponse>> {
    const result = conformBody(
      'notification-service',
      'getNotificationPreferences',
      GetNotificationPreferencesResponse,
      await this.relay(response, () => this.getPreferences.execute()),
    );
    response.setHeader('ETag', formatEtag(result.version));
    delete request.headers['if-none-match'];
    delete request.headers['if-modified-since'];
    return result;
  }

  /** Applies a validated patch, preserving the client's If-Match condition. */
  @Patch()
  @CredentialGuard.requires({
    operationId: 'updateNotificationPreferences',
    security: [{ sessionCookie: [] }],
    organization: false,
  })
  public async update(
    @RequiredBody(UpdateNotificationPreferencesBody)
    patch: z.output<typeof UpdateNotificationPreferencesBody>,
    @IfMatchHeader() ifMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof UpdateNotificationPreferencesResponse>> {
    const result = conformBody(
      'notification-service',
      'updateNotificationPreferences',
      UpdateNotificationPreferencesResponse,
      await this.relay(response, () => this.updatePreferences.execute(patch, ifMatch)),
    );
    response.setHeader('ETag', formatEtag(result.version));
    return result;
  }

  /** Maps the upstream's contract errors and current version to the public response. */
  private async relay<T>(response: Response, call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (error) {
      const translated = toPublicProblem(error, ACCEPTED);
      if (translated instanceof ProblemException && translated.problem.status === 412) {
        const version = translated.problem.details?.version;
        if (typeof version === 'number' && Number.isSafeInteger(version) && version > 0) {
          response.setHeader('ETag', formatEtag(version));
        }
      }
      throw translated;
    }
  }
  // #endregion
}

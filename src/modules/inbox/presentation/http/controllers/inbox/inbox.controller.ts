import {
  ArchiveInboxNotificationParams,
  ArchiveInboxNotificationResponse,
  GetInboxUnreadCountResponse,
  ListInboxNotificationsQueryParams,
  ListInboxNotificationsResponse,
  MarkInboxNotificationReadParams,
  MarkInboxNotificationReadResponse,
  MarkInboxNotificationsReadResponse,
} from '@cadenway/contracts/validators/public/inbox';
import {
  formatEtag,
  getOrganizationContext,
  ProblemException,
  ZodValidationPipe,
} from '@cadenway/nest-common';
import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { z } from 'zod';

import { conformBody } from '../../../../../../problems/upstream-answer.js';
import { toPublicProblem } from '../../../../../../problems/upstream-problem.js';
import { IfMatchHeader } from '../../../../../../presentation/http/mappers/request-headers.mapper.js';
import { verifiedSessionOf } from '../../../../../../presentation/http/session/request-session.js';
import { CredentialGuard } from '../../../../../auth/public/credential/credential-guard.js';
import { RateLimitGuard } from '../../../../../rate-limit/public/requests/rate-limit-guard.js';
import { InboxNotFound } from '../../../../application/models/inbox/inbox-not-found.model.js';
import { InboxUnavailable } from '../../../../application/models/inbox/inbox-unavailable.model.js';
import { InvalidInboxCursor } from '../../../../application/models/inbox/invalid-inbox-cursor.model.js';
import { ChangeInboxNotification } from '../../../../application/use-cases/commands/inbox/change-inbox-notification/change-inbox-notification.use-case.js';
import { MarkInboxNotificationsRead } from '../../../../application/use-cases/commands/inbox/mark-inbox-notifications-read/mark-inbox-notifications-read.use-case.js';
import { GetInboxUnreadCount } from '../../../../application/use-cases/queries/inbox/get-inbox-unread-count/get-inbox-unread-count.use-case.js';
import { ListInboxNotifications } from '../../../../application/use-cases/queries/inbox/list-inbox-notifications/list-inbox-notifications.use-case.js';

/** Personal inbox routes for a verified current organization member. */
@Controller('v1/inbox')
@UseGuards(CredentialGuard, RateLimitGuard)
export class InboxController {
  // #region Constructor
  /** Binds the four application operations. */
  public constructor(
    @Inject(ListInboxNotifications) private readonly list: ListInboxNotifications,
    @Inject(GetInboxUnreadCount) private readonly unread: GetInboxUnreadCount,
    @Inject(MarkInboxNotificationsRead) private readonly readAll: MarkInboxNotificationsRead,
    @Inject(ChangeInboxNotification) private readonly change: ChangeInboxNotification,
  ) {}
  // #endregion

  // #region Methods
  /** Returns a filtered page and the full accessible unread count. */
  @Get('notifications')
  @CredentialGuard.requires({
    operationId: 'listInboxNotifications',
    security: [{ sessionCookie: [] }],
    organization: true,
  })
  public async listNotifications(
    @Query(new ZodValidationPipe(ListInboxNotificationsQueryParams))
    query: z.output<typeof ListInboxNotificationsQueryParams>,
    @Req() request: Request,
  ): Promise<z.output<typeof ListInboxNotificationsResponse>> {
    const organizationId = getOrganizationContext()?.organizationId;
    const session = verifiedSessionOf(request);
    if (!organizationId || session === undefined) {
      throw new Error('The inbox list requires a verified organization and session.');
    }
    const result = await this.relay(() =>
      this.list.execute(
        { ...query, cursor: query.cursor ?? null },
        {
          organizationId,
          userId: session.userId,
        },
      ),
    );
    delete request.headers['if-none-match'];
    delete request.headers['if-modified-since'];
    return conformBody(
      'notification-service',
      'listInboxNotifications',
      ListInboxNotificationsResponse,
      result,
    );
  }

  /** Returns the accessible unread badge. */
  @Get('unread-count')
  @CredentialGuard.requires({
    operationId: 'getInboxUnreadCount',
    security: [{ sessionCookie: [] }],
    organization: true,
  })
  public async unreadCount(
    @Req() request: Request,
  ): Promise<z.output<typeof GetInboxUnreadCountResponse>> {
    const result = await this.relay(() => this.unread.execute());
    delete request.headers['if-none-match'];
    delete request.headers['if-modified-since'];
    return conformBody(
      'notification-service',
      'getInboxUnreadCount',
      GetInboxUnreadCountResponse,
      result,
    );
  }

  /** Marks the verified visible selection through the original cutoff. */
  @Post('notifications/read-all')
  @HttpCode(200)
  @CredentialGuard.requires({
    operationId: 'markInboxNotificationsRead',
    security: [{ sessionCookie: [] }],
    organization: true,
    allowBodylessPost: true,
  })
  public async markAll(): Promise<z.output<typeof MarkInboxNotificationsReadResponse>> {
    return conformBody(
      'notification-service',
      'markInboxNotificationsRead',
      MarkInboxNotificationsReadResponse,
      await this.relay(() => this.readAll.execute()),
    );
  }

  /** Marks one currently visible notification as read. */
  @Post('notifications/:notificationId/read')
  @HttpCode(200)
  @CredentialGuard.requires({
    operationId: 'markInboxNotificationRead',
    security: [{ sessionCookie: [] }],
    organization: true,
    allowBodylessPost: true,
  })
  public async markRead(
    @Param(new ZodValidationPipe(MarkInboxNotificationReadParams))
    params: z.output<typeof MarkInboxNotificationReadParams>,
    @IfMatchHeader() ifMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof MarkInboxNotificationReadResponse>> {
    const result = await this.relay(
      () => this.change.execute(params.notificationId, 'read', ifMatch),
      response,
    );
    const body = conformBody(
      'notification-service',
      'markInboxNotificationRead',
      MarkInboxNotificationReadResponse,
      result,
    );
    response.setHeader('ETag', formatEtag(body.version));
    return body;
  }

  /** Archives one currently visible notification. */
  @Post('notifications/:notificationId/archive')
  @HttpCode(200)
  @CredentialGuard.requires({
    operationId: 'archiveInboxNotification',
    security: [{ sessionCookie: [] }],
    organization: true,
    allowBodylessPost: true,
  })
  public async archive(
    @Param(new ZodValidationPipe(ArchiveInboxNotificationParams))
    params: z.output<typeof ArchiveInboxNotificationParams>,
    @IfMatchHeader() ifMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof ArchiveInboxNotificationResponse>> {
    const result = await this.relay(
      () => this.change.execute(params.notificationId, 'archive', ifMatch),
      response,
    );
    const body = conformBody(
      'notification-service',
      'archiveInboxNotification',
      ArchiveInboxNotificationResponse,
      result,
    );
    response.setHeader('ETag', formatEtag(body.version));
    return body;
  }

  /** Maps only the public contract's error codes and precondition version. */
  private async relay<T>(call: () => Promise<T>, response?: Response): Promise<T> {
    try {
      return await call();
    } catch (error) {
      if (error instanceof InboxNotFound) {
        throw new ProblemException({ status: 404, code: 'notification.not-found' });
      }
      if (error instanceof InvalidInboxCursor) {
        throw new ProblemException({
          status: 400,
          code: 'request.invalid',
          detail: 'The request does not match its contract.',
          details: { issues: [{ in: 'query', path: 'cursor', code: 'invalid_cursor' }] },
        });
      }
      if (error instanceof InboxUnavailable) {
        throw new ProblemException({
          status: 503,
          code: error.code,
          details: { service: error.service },
        });
      }
      const translated = toPublicProblem(error, {
        400: ['request.invalid'],
        403: ['organization.not-selected', 'organization.mfa-required'],
        404: ['notification.not-found', 'organization.not-found'],
        412: ['request.version-mismatch'],
      });
      if (translated instanceof ProblemException && translated.problem.status === 412) {
        const version = translated.problem.details?.version;
        if (typeof version === 'number' && Number.isSafeInteger(version) && version > 0)
          response?.setHeader('ETag', formatEtag(version));
      }
      throw translated;
    }
  }
  // #endregion
}

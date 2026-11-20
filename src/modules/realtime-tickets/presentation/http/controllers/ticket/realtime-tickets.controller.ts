import {
  IssueRealtimeTicketBody,
  IssueRealtimeTicketResponse,
} from '@cadenway/contracts/validators/public/realtime';
import { Controller, HttpCode, Inject, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { z } from 'zod';

import { conformBody } from '../../../../../../problems/upstream-answer.js';
import {
  relaySessionUpstream,
  type AcceptedProblems,
} from '../../../../../../problems/upstream-problem.js';
import { RequiredBody } from '../../../../../../presentation/http/mappers/request-body.mapper.js';
import { verifiedSessionOf } from '../../../../../../presentation/http/session/request-session.js';
import { CredentialGuard } from '../../../../../auth/public/credential/credential-guard.js';
import { RateLimitGuard } from '../../../../../rate-limit/public/requests/rate-limit-guard.js';
import { IssueRealtimeTicket } from '../../../../application/use-cases/commands/ticket/issue-realtime-ticket/issue-realtime-ticket.use-case.js';

const ACCEPTED: AcceptedProblems = {
  403: ['organization.not-selected', 'organization.mfa-required'],
  404: ['organization.not-found'],
};

/** Issues a realtime ticket for the active browser session and its selected organization. */
@Controller('v1/realtime/tickets')
@UseGuards(CredentialGuard, RateLimitGuard)
export class RealtimeTicketsController {
  // #region Constructor
  /** Binds the session-bound Identity issuance operation. */
  public constructor(
    @Inject(IssueRealtimeTicket) private readonly issueTicket: IssueRealtimeTicket,
  ) {}
  // #endregion

  // #region Methods
  /** Returns only the ticket and its expiration after checking the empty JSON body. */
  @Post()
  @HttpCode(200)
  @CredentialGuard.requires({
    operationId: 'issueRealtimeTicket',
    security: [{ sessionCookie: [] }],
    organization: true,
  })
  public async issue(
    @RequiredBody(IssueRealtimeTicketBody) _body: z.output<typeof IssueRealtimeTicketBody>,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof IssueRealtimeTicketResponse>> {
    const session = verifiedSessionOf(request);
    if (session === undefined)
      throw new Error('Realtime ticket route requires a verified session.');
    const ticket = await relaySessionUpstream(
      response,
      ACCEPTED,
      () => this.issueTicket.execute(session.sessionId),
      ['session.not-found'],
    );
    return conformBody(
      'identity-service',
      'issueRealtimeTicket',
      IssueRealtimeTicketResponse,
      ticket,
    );
  }
  // #endregion
}

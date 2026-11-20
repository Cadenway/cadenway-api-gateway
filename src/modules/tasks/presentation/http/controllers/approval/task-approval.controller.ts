import {
  GetTaskApprovalParams,
  GetTaskApprovalResponse,
  RequestTaskApprovalBody,
  RequestTaskApprovalHeader,
  RequestTaskApprovalParams,
  RequestTaskApprovalResponse,
  VoteOnTaskApprovalBody,
  VoteOnTaskApprovalHeader,
  VoteOnTaskApprovalParams,
  VoteOnTaskApprovalResponse,
  WithdrawTaskApprovalVoteHeader,
  WithdrawTaskApprovalVoteParams,
} from '@cadenway/contracts/validators/public/tasks';
import { formatEtag, ZodValidationPipe } from '@cadenway/nest-common';
import {
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  Post,
  Put,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import type { z } from 'zod';

import { conformBody, outsideContract } from '../../../../../../problems/upstream-answer.js';
import {
  relayProblems,
  type AcceptedProblems,
} from '../../../../../../problems/upstream-problem.js';
import { RequiredBody } from '../../../../../../presentation/http/mappers/request-body.mapper.js';
import { toRequestHeader } from '../../../../../../presentation/http/mappers/request-headers.mapper.js';
import { CredentialGuard } from '../../../../../auth/public/credential/credential-guard.js';
import { RateLimitGuard } from '../../../../../rate-limit/public/requests/rate-limit-guard.js';
import { GetTaskApproval } from '../../../../application/use-cases/queries/approval/get-task-approval/get-task-approval.use-case.js';
import { RequestTaskApproval } from '../../../../application/use-cases/commands/approval/request-task-approval/request-task-approval.use-case.js';
import { VoteOnTaskApproval } from '../../../../application/use-cases/commands/approval/vote-on-task-approval/vote-on-task-approval.use-case.js';
import { WithdrawTaskApprovalVote } from '../../../../application/use-cases/commands/approval/withdraw-task-approval-vote/withdraw-task-approval-vote.use-case.js';

const READ: AcceptedProblems = {
  400: ['request.invalid'],
  404: ['task.not-found', 'task.trashed', 'organization.not-found'],
};
const REQUEST: AcceptedProblems = {
  ...READ,
  403: ['access.role-insufficient'],
  409: ['task.archived', 'approval.milestone-unsupported'],
  412: ['request.version-mismatch'],
  422: ['approval.reviewer-invalid'],
};
const VOTE: AcceptedProblems = {
  ...REQUEST,
  403: ['access.role-insufficient', 'approval.reviewer-required'],
  404: ['task.not-found', 'task.trashed', 'organization.not-found', 'approval.round-not-found'],
  409: [
    'task.archived',
    'approval.milestone-unsupported',
    'approval.vote-already-recorded',
    'recurrence.already-spawned',
  ],
  422: ['task.status-hidden', 'task.subtask-limit-reached', 'recurrence.date-out-of-range'],
};
const WITHDRAW: AcceptedProblems = {
  ...VOTE,
  409: ['task.archived', 'approval.milestone-unsupported'],
};

/** Public approval operations on the caller's visible task. */
@Controller('v1')
@UseGuards(CredentialGuard, RateLimitGuard)
export class TaskApprovalController {
  // #region Constructor
  /** Binds the approval use cases. */
  public constructor(
    @Inject(GetTaskApproval) private readonly reading: GetTaskApproval,
    @Inject(RequestTaskApproval) private readonly requesting: RequestTaskApproval,
    @Inject(VoteOnTaskApproval) private readonly voting: VoteOnTaskApproval,
    @Inject(WithdrawTaskApprovalVote) private readonly withdrawing: WithdrawTaskApprovalVote,
  ) {}
  // #endregion

  // #region Methods
  /** Reads the current round. */
  @Get('tasks/:taskKey/approvals')
  @CredentialGuard.requires({
    operationId: 'getTaskApproval',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:read'] }],
    organization: true,
  })
  public async get(
    @Param(new ZodValidationPipe(GetTaskApprovalParams))
    params: z.output<typeof GetTaskApprovalParams>,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof GetTaskApprovalResponse>> {
    const result = await relayProblems(READ, () => this.reading.execute(params.taskKey));
    const body = conformBody(
      'task-service',
      'getTaskApproval',
      GetTaskApprovalResponse,
      result.body,
    );
    if (body.taskKey !== params.taskKey || body.taskVersion !== result.version)
      throw outsideContract('task-service', 'getTaskApproval', 'an inconsistent task or ETag');
    response.setHeader('ETag', formatEtag(result.version));
    return body;
  }

  /** Starts a new approval round. */
  @Post('tasks/:taskKey/approvals/request')
  @HttpCode(200)
  @CredentialGuard.requires({
    operationId: 'requestTaskApproval',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
  })
  public async request(
    @Param(new ZodValidationPipe(RequestTaskApprovalParams))
    params: z.output<typeof RequestTaskApprovalParams>,
    @RequiredBody(RequestTaskApprovalBody) input: z.output<typeof RequestTaskApprovalBody>,
    @Headers('if-match') header: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof RequestTaskApprovalResponse>> {
    const ifMatch = toRequestHeader(
      'If-Match',
      RequestTaskApprovalHeader.shape['If-Match'],
      header,
    );
    const result = await relayProblems(REQUEST, () =>
      this.requesting.execute(params.taskKey, input, ifMatch),
    );
    const body = conformBody(
      'task-service',
      'requestTaskApproval',
      RequestTaskApprovalResponse,
      result.body,
    );
    if (body.taskKey !== params.taskKey || body.taskVersion !== result.version)
      throw outsideContract('task-service', 'requestTaskApproval', 'an inconsistent task or ETag');
    response.setHeader('ETag', formatEtag(result.version));
    return body;
  }

  /** Records the caller's vote. */
  @Put('tasks/:taskKey/approvals/:roundId/votes/me')
  @CredentialGuard.requires({
    operationId: 'voteOnTaskApproval',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
  })
  public async vote(
    @Param(new ZodValidationPipe(VoteOnTaskApprovalParams))
    params: z.output<typeof VoteOnTaskApprovalParams>,
    @RequiredBody(VoteOnTaskApprovalBody) input: z.output<typeof VoteOnTaskApprovalBody>,
    @Headers('if-match') header: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof VoteOnTaskApprovalResponse>> {
    const ifMatch = toRequestHeader('If-Match', VoteOnTaskApprovalHeader.shape['If-Match'], header);
    const result = await relayProblems(VOTE, () =>
      this.voting.execute(params.taskKey, params.roundId, input, ifMatch),
    );
    const body = conformBody(
      'task-service',
      'voteOnTaskApproval',
      VoteOnTaskApprovalResponse,
      result.body,
    );
    if (
      body.taskKey !== params.taskKey ||
      body.taskVersion !== result.version ||
      body.current?.roundId.toLowerCase() !== params.roundId.toLowerCase()
    )
      throw outsideContract(
        'task-service',
        'voteOnTaskApproval',
        'an inconsistent task, round or ETag',
      );
    response.setHeader('ETag', formatEtag(result.version));
    return body;
  }

  /** Withdraws the caller's vote. */
  @Delete('tasks/:taskKey/approvals/:roundId/votes/me')
  @HttpCode(204)
  @CredentialGuard.requires({
    operationId: 'withdrawTaskApprovalVote',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
  })
  public async withdraw(
    @Param(new ZodValidationPipe(WithdrawTaskApprovalVoteParams))
    params: z.output<typeof WithdrawTaskApprovalVoteParams>,
    @Headers('if-match') header: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const ifMatch = toRequestHeader(
      'If-Match',
      WithdrawTaskApprovalVoteHeader.shape['If-Match'],
      header,
    );
    const result = await relayProblems(WITHDRAW, () =>
      this.withdrawing.execute(params.taskKey, params.roundId, ifMatch),
    );
    response.setHeader('ETag', formatEtag(result.version));
  }
  // #endregion
}

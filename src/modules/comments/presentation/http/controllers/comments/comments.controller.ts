import {
  CreateTaskCommentBody,
  CreateTaskCommentHeader,
  CreateTaskCommentParams,
  CreateTaskCommentResponse,
  GetTaskCommentParams,
  GetTaskCommentResponse,
  UpdateTaskCommentParams,
  UpdateTaskCommentBody,
  UpdateTaskCommentHeader,
  UpdateTaskCommentResponse,
  DeleteTaskCommentParams,
  ListTaskCommentsParams,
  ListTaskCommentsQueryParams,
  ListTaskCommentsResponse,
  ListTaskParticipantsParams,
  ListTaskParticipantsQueryParams,
  ListTaskParticipantsResponse,
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
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import type { z } from 'zod';
import { conformBody } from '../../../../../../problems/upstream-answer.js';
import {
  relayProblems,
  type AcceptedProblems,
} from '../../../../../../problems/upstream-problem.js';
import { RequiredBody } from '../../../../../../presentation/http/mappers/request-body.mapper.js';
import {
  IfMatchHeader,
  toRequestHeader,
} from '../../../../../../presentation/http/mappers/request-headers.mapper.js';
import { CredentialGuard } from '../../../../../auth/public/credential/credential-guard.js';
import { RateLimitGuard } from '../../../../../rate-limit/public/requests/rate-limit-guard.js';
import { ListTaskComments } from '../../../../application/use-cases/queries/comments/list-task-comments/list-task-comments.use-case.js';
import { CreateTaskComment } from '../../../../application/use-cases/commands/comments/create-task-comment/create-task-comment.use-case.js';
import { GetTaskComment } from '../../../../application/use-cases/queries/comments/get-task-comment/get-task-comment.use-case.js';
import { UpdateTaskComment } from '../../../../application/use-cases/commands/comments/update-task-comment/update-task-comment.use-case.js';
import { DeleteTaskComment } from '../../../../application/use-cases/commands/comments/delete-task-comment/delete-task-comment.use-case.js';
import { ListTaskParticipants } from '../../../../application/use-cases/queries/comments/list-task-participants/list-task-participants.use-case.js';

/** The list of task visibility errors. */
const TASK_READ: AcceptedProblems = {
  400: ['request.invalid'],
  404: ['task.not-found', 'task.trashed', 'organization.not-found'],
};
/** The comment visibility errors. */
const COMMENT_READ: AcceptedProblems = {
  400: ['request.invalid'],
  404: ['comment.not-found', 'task.not-found', 'task.trashed', 'organization.not-found'],
};
/** Errors declared by comment creation. */
const CREATE: AcceptedProblems = {
  ...COMMENT_READ,
  403: ['access.role-insufficient'],
  409: ['task.archived', 'idempotency.request-in-progress'],
  422: ['mention.recipient-invalid', 'idempotency.key-reused'],
};
/** Errors declared by comment changes. */
const CHANGE: AcceptedProblems = {
  ...COMMENT_READ,
  403: ['access.role-insufficient', 'comment.author-required'],
  409: ['task.archived'],
  412: ['request.version-mismatch'],
  422: ['mention.recipient-invalid'],
};
/** Errors declared by comment deletion. */
const REMOVE: AcceptedProblems = {
  ...COMMENT_READ,
  403: ['access.role-insufficient', 'comment.author-required'],
  409: ['task.archived'],
  412: ['request.version-mismatch'],
};
/** Errors of the participant page. */
const PARTICIPANTS: AcceptedProblems = { ...TASK_READ, 403: ['access.role-insufficient'] };

/** Public task comments and eligible participants. */
@Controller('v1')
@UseGuards(CredentialGuard, RateLimitGuard)
export class CommentsController {
  // #region Properties
  /** Use case for listTaskComments. */
  private readonly listTaskCommentsUseCase: ListTaskComments;

  /** Use case for createTaskComment. */
  private readonly createTaskCommentUseCase: CreateTaskComment;

  /** Use case for getTaskComment. */
  private readonly getTaskCommentUseCase: GetTaskComment;

  /** Use case for updateTaskComment. */
  private readonly updateTaskCommentUseCase: UpdateTaskComment;

  /** Use case for deleteTaskComment. */
  private readonly deleteTaskCommentUseCase: DeleteTaskComment;

  /** Use case for listTaskParticipants. */
  private readonly listTaskParticipantsUseCase: ListTaskParticipants;
  // #endregion

  // #region Constructor
  /** Binds the route use cases. */
  public constructor(
    @Inject(ListTaskComments) listTaskComments: ListTaskComments,
    @Inject(CreateTaskComment) createTaskComment: CreateTaskComment,
    @Inject(GetTaskComment) getTaskComment: GetTaskComment,
    @Inject(UpdateTaskComment) updateTaskComment: UpdateTaskComment,
    @Inject(DeleteTaskComment) deleteTaskComment: DeleteTaskComment,
    @Inject(ListTaskParticipants) listTaskParticipants: ListTaskParticipants,
  ) {
    this.listTaskCommentsUseCase = listTaskComments;
    this.createTaskCommentUseCase = createTaskComment;
    this.getTaskCommentUseCase = getTaskComment;
    this.updateTaskCommentUseCase = updateTaskComment;
    this.deleteTaskCommentUseCase = deleteTaskComment;
    this.listTaskParticipantsUseCase = listTaskParticipants;
  }
  // #endregion

  // #region Methods
  /** Lists the task comment page. */
  @Get('tasks/:taskKey/comments')
  @CredentialGuard.requires({
    operationId: 'listTaskComments',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:read'] }],
    organization: true,
  })
  public async listTaskComments(
    @Param(new ZodValidationPipe(ListTaskCommentsParams))
    params: z.output<typeof ListTaskCommentsParams>,
    @Query(new ZodValidationPipe(ListTaskCommentsQueryParams))
    query: z.output<typeof ListTaskCommentsQueryParams>,
  ): Promise<z.output<typeof ListTaskCommentsResponse>> {
    return conformBody(
      'task-service',
      'listTaskComments',
      ListTaskCommentsResponse,
      await relayProblems(TASK_READ, () =>
        this.listTaskCommentsUseCase.execute(params.taskKey, query),
      ),
    );
  }

  /** Creates a comment with its public location and version. */
  @Post('tasks/:taskKey/comments')
  @CredentialGuard.requires({
    operationId: 'createTaskComment',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
  })
  public async createTaskComment(
    @Param(new ZodValidationPipe(CreateTaskCommentParams))
    params: z.output<typeof CreateTaskCommentParams>,
    @RequiredBody(CreateTaskCommentBody) body: z.output<typeof CreateTaskCommentBody>,
    @Headers('idempotency-key') key: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof CreateTaskCommentResponse>> {
    const idempotencyKey = toRequestHeader(
      'Idempotency-Key',
      CreateTaskCommentHeader.shape['Idempotency-Key'],
      key,
    );
    const result = conformBody(
      'task-service',
      'createTaskComment',
      CreateTaskCommentResponse,
      await relayProblems(CREATE, () =>
        this.createTaskCommentUseCase.execute(params.taskKey, body, idempotencyKey),
      ),
    );
    response.setHeader('ETag', formatEtag(result.version));
    response.setHeader('Location', `/v1/tasks/${result.taskKey}/comments/${result.id}`);
    return result;
  }

  /** Reads one comment with its version. */
  @Get('tasks/:taskKey/comments/:commentId')
  @CredentialGuard.requires({
    operationId: 'getTaskComment',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:read'] }],
    organization: true,
  })
  public async getTaskComment(
    @Param(new ZodValidationPipe(GetTaskCommentParams))
    params: z.output<typeof GetTaskCommentParams>,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof GetTaskCommentResponse>> {
    const result = conformBody(
      'task-service',
      'getTaskComment',
      GetTaskCommentResponse,
      await relayProblems(COMMENT_READ, () =>
        this.getTaskCommentUseCase.execute(params.taskKey, params.commentId),
      ),
    );
    response.setHeader('ETag', formatEtag(result.version));
    return result;
  }

  /** Changes a comment using its required version precondition. */
  @Patch('tasks/:taskKey/comments/:commentId')
  @CredentialGuard.requires({
    operationId: 'updateTaskComment',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
  })
  public async updateTaskComment(
    @Param(new ZodValidationPipe(UpdateTaskCommentParams))
    params: z.output<typeof UpdateTaskCommentParams>,
    @RequiredBody(UpdateTaskCommentBody) body: z.output<typeof UpdateTaskCommentBody>,
    @IfMatchHeader() ifMatch: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof UpdateTaskCommentResponse>> {
    const required = toRequestHeader(
      'If-Match',
      UpdateTaskCommentHeader.shape['If-Match'],
      ifMatch,
    );
    const result = conformBody(
      'task-service',
      'updateTaskComment',
      UpdateTaskCommentResponse,
      await relayProblems(CHANGE, () =>
        this.updateTaskCommentUseCase.execute(params.taskKey, params.commentId, body, required),
      ),
    );
    response.setHeader('ETag', formatEtag(result.version));
    return result;
  }

  /** Deletes a comment once with an optional version precondition. */
  @Delete('tasks/:taskKey/comments/:commentId')
  @HttpCode(204)
  @CredentialGuard.requires({
    operationId: 'deleteTaskComment',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
  })
  public async deleteTaskComment(
    @Param(new ZodValidationPipe(DeleteTaskCommentParams))
    params: z.output<typeof DeleteTaskCommentParams>,
    @IfMatchHeader() ifMatch: string | undefined,
  ): Promise<void> {
    return relayProblems(REMOVE, () =>
      this.deleteTaskCommentUseCase.execute(params.taskKey, params.commentId, ifMatch),
    );
  }

  /** Lists eligible participants for a task. */
  @Get('tasks/:taskKey/participants')
  @CredentialGuard.requires({
    operationId: 'listTaskParticipants',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:read'] }],
    organization: true,
  })
  public async listTaskParticipants(
    @Param(new ZodValidationPipe(ListTaskParticipantsParams))
    params: z.output<typeof ListTaskParticipantsParams>,
    @Query(new ZodValidationPipe(ListTaskParticipantsQueryParams))
    query: z.output<typeof ListTaskParticipantsQueryParams>,
  ): Promise<z.output<typeof ListTaskParticipantsResponse>> {
    return conformBody(
      'task-service',
      'listTaskParticipants',
      ListTaskParticipantsResponse,
      await relayProblems(PARTICIPANTS, () =>
        this.listTaskParticipantsUseCase.execute(params.taskKey, query),
      ),
    );
  }
  // #endregion
}

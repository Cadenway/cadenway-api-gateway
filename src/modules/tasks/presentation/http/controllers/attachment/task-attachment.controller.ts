import {
  ListTaskAttachmentsParams,
  ListTaskAttachmentsQueryParams,
  ListTaskAttachmentsResponse,
  StartTaskAttachmentUploadParams,
  StartTaskAttachmentUploadHeader,
  StartTaskAttachmentUploadBody,
  StartTaskAttachmentUploadResponse,
  GetTaskAttachmentParams,
  GetTaskAttachmentResponse,
  DeleteTaskAttachmentParams,
  DeleteTaskAttachmentHeader,
  CompleteTaskAttachmentUploadParams,
  CompleteTaskAttachmentUploadResponse,
  GetTaskAttachmentDownloadParams,
  GetTaskAttachmentDownloadResponse,
} from '@cadenway/contracts/validators/public/attachments';
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
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
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
import { ListAttachments } from '../../../../application/use-cases/queries/attachment/list-attachments/list-attachments.use-case.js';
import { StartAttachmentUpload } from '../../../../application/use-cases/commands/attachment/start-attachment-upload/start-attachment-upload.use-case.js';
import { GetAttachment } from '../../../../application/use-cases/queries/attachment/get-attachment/get-attachment.use-case.js';
import { CompleteAttachmentUpload } from '../../../../application/use-cases/commands/attachment/complete-attachment-upload/complete-attachment-upload.use-case.js';
import { GetAttachmentDownload } from '../../../../application/use-cases/queries/attachment/get-attachment-download/get-attachment-download.use-case.js';
import { DeleteAttachment } from '../../../../application/use-cases/commands/attachment/delete-attachment/delete-attachment.use-case.js';

const READ: AcceptedProblems = {
  400: ['request.invalid'],
  404: ['task.not-found', 'organization.not-found', 'attachment.not-found'],
};
const LIST: AcceptedProblems = {
  400: ['request.invalid'],
  404: ['task.not-found', 'organization.not-found'],
};
const START: AcceptedProblems = {
  ...READ,
  403: ['access.role-insufficient'],
  409: ['task.archived', 'idempotency.request-in-progress'],
  422: [
    'attachment.file-too-large',
    'attachment.upload-metadata-mismatch',
    'idempotency.key-reused',
  ],
};
const COMPLETE: AcceptedProblems = {
  ...READ,
  403: ['access.role-insufficient'],
  409: [
    'task.archived',
    'attachment.upload-expired',
    'attachment.upload-not-ready',
    'attachment.storage-quota-exceeded',
  ],
  422: ['attachment.file-too-large', 'attachment.upload-metadata-mismatch'],
};
const REMOVE: AcceptedProblems = {
  ...READ,
  403: ['access.role-insufficient'],
  409: ['task.archived'],
  412: ['request.version-mismatch'],
};

/** Prevents Express from returning an undeclared conditional 304 for these JSON reads. */
function disableConditionalRead(request: Request): void {
  delete request.headers['if-none-match'];
  delete request.headers['if-modified-since'];
}

/** Public attachment operations guarded by the task's current visibility. */
@Controller('v1/tasks/:taskKey/attachments')
@UseGuards(CredentialGuard, RateLimitGuard)
export class TaskAttachmentController {
  // #region Constructor
  /** Binds the six attachment operations. */
  public constructor(
    @Inject(ListAttachments) private readonly listing: ListAttachments,
    @Inject(StartAttachmentUpload) private readonly starting: StartAttachmentUpload,
    @Inject(GetAttachment) private readonly getting: GetAttachment,
    @Inject(CompleteAttachmentUpload) private readonly completing: CompleteAttachmentUpload,
    @Inject(GetAttachmentDownload) private readonly downloading: GetAttachmentDownload,
    @Inject(DeleteAttachment) private readonly deleting: DeleteAttachment,
  ) {}
  // #endregion

  // #region Methods
  /** Lists ready files on a readable task. */
  @Get()
  @CredentialGuard.requires({
    operationId: 'listTaskAttachments',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:read'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async list(
    @Param(new ZodValidationPipe(ListTaskAttachmentsParams))
    params: z.output<typeof ListTaskAttachmentsParams>,
    @Query(new ZodValidationPipe(ListTaskAttachmentsQueryParams.strict()))
    query: z.output<typeof ListTaskAttachmentsQueryParams>,
    @Req() request: Request,
  ): Promise<z.output<typeof ListTaskAttachmentsResponse>> {
    const result = conformBody(
      'storage-service',
      'listTaskAttachments',
      ListTaskAttachmentsResponse,
      await relayProblems(LIST, () => this.listing.execute(params.taskKey, query), [404]),
    );
    if (result.items.some((item) => item.taskKey !== params.taskKey)) {
      throw outsideContract(
        'storage-service',
        'listTaskAttachments',
        'an attachment outside the task',
      );
    }
    disableConditionalRead(request);
    return result;
  }

  /** Creates a signed multipart capability. */
  @Post()
  @CredentialGuard.requires({
    operationId: 'startTaskAttachmentUpload',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async start(
    @Param(new ZodValidationPipe(StartTaskAttachmentUploadParams))
    params: z.output<typeof StartTaskAttachmentUploadParams>,
    @RequiredBody(StartTaskAttachmentUploadBody)
    body: z.output<typeof StartTaskAttachmentUploadBody>,
    @Headers('idempotency-key') header: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof StartTaskAttachmentUploadResponse>> {
    const key = toRequestHeader(
      'Idempotency-Key',
      StartTaskAttachmentUploadHeader.shape['Idempotency-Key'],
      header,
    );
    const result = conformBody(
      'storage-service',
      'startTaskAttachmentUpload',
      StartTaskAttachmentUploadResponse,
      await relayProblems(START, () => this.starting.execute(params.taskKey, body, key), [404]),
    );
    response.setHeader('Location', `/v1/tasks/${params.taskKey}/attachments/${result.id}`);
    response.setHeader('Cache-Control', 'no-store');
    return result;
  }

  /** Reads ready attachment metadata. */
  @Get(':attachmentId')
  @CredentialGuard.requires({
    operationId: 'getTaskAttachment',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:read'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async get(
    @Param(new ZodValidationPipe(GetTaskAttachmentParams))
    params: z.output<typeof GetTaskAttachmentParams>,
    @Res({ passthrough: true }) response: Response,
    @Req() request: Request,
  ): Promise<z.output<typeof GetTaskAttachmentResponse>> {
    const result = conformBody(
      'storage-service',
      'getTaskAttachment',
      GetTaskAttachmentResponse,
      await relayProblems(
        READ,
        () => this.getting.execute(params.taskKey, params.attachmentId),
        [404],
      ),
    );
    if (
      result.taskKey !== params.taskKey ||
      result.id.toLowerCase() !== params.attachmentId.toLowerCase()
    ) {
      throw outsideContract(
        'storage-service',
        'getTaskAttachment',
        'an attachment outside the requested task',
      );
    }
    response.setHeader('ETag', formatEtag(result.version));
    disableConditionalRead(request);
    return result;
  }

  /** Completes a staged upload. */
  @Post(':attachmentId/completion')
  @HttpCode(200)
  @CredentialGuard.requires({
    operationId: 'completeTaskAttachmentUpload',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async complete(
    @Param(new ZodValidationPipe(CompleteTaskAttachmentUploadParams))
    params: z.output<typeof CompleteTaskAttachmentUploadParams>,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof CompleteTaskAttachmentUploadResponse>> {
    const result = conformBody(
      'storage-service',
      'completeTaskAttachmentUpload',
      CompleteTaskAttachmentUploadResponse,
      await relayProblems(
        COMPLETE,
        () => this.completing.execute(params.taskKey, params.attachmentId),
        [404],
      ),
    );
    if (
      result.taskKey !== params.taskKey ||
      result.id.toLowerCase() !== params.attachmentId.toLowerCase()
    ) {
      throw outsideContract(
        'storage-service',
        'completeTaskAttachmentUpload',
        'an attachment outside the requested task',
      );
    }
    response.setHeader('ETag', formatEtag(result.version));
    return result;
  }

  /** Signs a short-lived download. */
  @Get(':attachmentId/download')
  @CredentialGuard.requires({
    operationId: 'getTaskAttachmentDownload',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:read'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async download(
    @Param(new ZodValidationPipe(GetTaskAttachmentDownloadParams))
    params: z.output<typeof GetTaskAttachmentDownloadParams>,
    @Res({ passthrough: true }) response: Response,
    @Req() request: Request,
  ): Promise<z.output<typeof GetTaskAttachmentDownloadResponse>> {
    const result = conformBody(
      'storage-service',
      'getTaskAttachmentDownload',
      GetTaskAttachmentDownloadResponse,
      await relayProblems(
        READ,
        () => this.downloading.execute(params.taskKey, params.attachmentId),
        [404],
      ),
    );
    response.setHeader('Cache-Control', 'no-store');
    disableConditionalRead(request);
    return result;
  }

  /** Removes a ready attachment. */
  @Delete(':attachmentId')
  @HttpCode(204)
  @CredentialGuard.requires({
    operationId: 'deleteTaskAttachment',
    security: [{ sessionCookie: [] }, { apiToken: ['tasks:write'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async remove(
    @Param(new ZodValidationPipe(DeleteTaskAttachmentParams))
    params: z.output<typeof DeleteTaskAttachmentParams>,
    @Headers('if-match') header: string | undefined,
  ): Promise<void> {
    const ifMatch = toRequestHeader(
      'If-Match',
      DeleteTaskAttachmentHeader.shape['If-Match'],
      header,
    );
    await relayProblems(
      REMOVE,
      () => this.deleting.execute(params.taskKey, params.attachmentId, ifMatch),
      [404],
    );
  }
  // #endregion
}

import {
  CompleteTaskAttachmentUploadInternalResponse,
  GetTaskAttachmentDownloadInternalResponse,
  GetTaskAttachmentInternalResponse,
  ListLargestAttachmentsInternalQueryParams,
  ListLargestAttachmentsInternalResponse,
  ListTaskAttachmentsInternalQueryParams,
  ListTaskAttachmentsInternalResponse,
  StartTaskAttachmentUploadInternalBody,
  StartTaskAttachmentUploadInternalResponse,
} from '@cadenway/contracts/validators/internal/storage-service';
import { ProblemException } from '@cadenway/nest-common';
import type { InternalHttpClient, InternalRequestInit } from '@cadenway/nest-common';
import type { z } from 'zod';

import {
  answered as answeredBy,
  expectBody,
  expectStatus,
  outsideContract,
} from '../problems/upstream-answer.js';
import type { GeneratedResponse } from '../problems/upstream-answer.js';
import { getStorageServiceInternalRoutes } from './generated/storage-service.js';

/** Audience and upstream name of the signed Storage client. */
export const STORAGE_SERVICE: string = 'storage-service';

type StorageRoutes = ReturnType<typeof getStorageServiceInternalRoutes>;
type StorageAnswer = GeneratedResponse & { readonly headers: Headers };
const SEND_ONCE: InternalRequestInit = { idempotent: false };

/** Maps body-read deadlines after headers to the same stable upstream timeout as the transport. */
async function answered<T>(service: string, operation: string, pending: Promise<T>): Promise<T> {
  try {
    return await answeredBy(service, operation, pending);
  } catch (error: unknown) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new ProblemException({
        status: 503,
        code: 'upstream.timeout',
        detail: 'A service this request depends on is not available.',
        details: { service },
      });
    }
    throw error;
  }
}

/** Checks a request built by the gateway before calling the generated client. */
function request<T extends z.ZodType>(operation: string, schema: T, value: unknown): z.output<T> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    const members = parsed.error.issues.map((issue) => issue.path.join('.') || '(body)').join(', ');
    throw new Error(`The gateway built ${operation} outside the internal contract: ${members}.`);
  }
  return parsed.data;
}

/** Ensures a response carrying a signed capability is not cached. */
function noStore(operation: string, answer: StorageAnswer): void {
  if (answer.headers.get('Cache-Control')?.toLowerCase() !== 'no-store') {
    throw outsideContract(STORAGE_SERVICE, operation, 'missing Cache-Control no-store');
  }
}

/** Verifies that a strong ETag agrees with the attachment version. */
function versioned(operation: string, answer: StorageAnswer, version: number): void {
  if (answer.headers.get('ETag') !== `"${String(version)}"`) {
    throw outsideContract(STORAGE_SERVICE, operation, 'an inconsistent attachment ETag');
  }
}

/** Calls the generated Storage routes through the signed internal HTTP client. */
export class StorageServiceClient {
  // #region Properties
  /** Generated operations bound to the internal transport. */
  private readonly routes: StorageRoutes;
  // #endregion

  // #region Constructor
  /** Binds the internal transport and its configured Storage endpoint. */
  public constructor(http: InternalHttpClient) {
    this.routes = getStorageServiceInternalRoutes(
      async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
        if (typeof input !== 'string')
          throw new Error('The generated storage client passes a path.');
        return http.fetch(input, init);
      },
    );
  }
  // #endregion

  // #region Methods
  /** Lists ready attachments for an already-authorized task. */
  public async listTaskAttachments(
    taskKey: string,
    query: unknown,
  ): Promise<z.output<typeof ListTaskAttachmentsInternalResponse>> {
    const operation = 'listTaskAttachmentsInternal';
    const answer = await answered(
      STORAGE_SERVICE,
      operation,
      this.routes.listTaskAttachmentsInternal(
        taskKey,
        request(operation, ListTaskAttachmentsInternalQueryParams, query),
        SEND_ONCE,
      ),
    );
    const page = expectBody(
      STORAGE_SERVICE,
      operation,
      answer,
      200,
      ListTaskAttachmentsInternalResponse,
    );
    if (page.items.some((item) => item.taskKey !== taskKey)) {
      throw outsideContract(STORAGE_SERVICE, operation, 'an inconsistent attachment task');
    }
    return page;
  }

  /** Reserves an upload and validates its private capability response. */
  public async startTaskAttachmentUpload(
    taskKey: string,
    body: unknown,
    key?: string,
  ): Promise<z.output<typeof StartTaskAttachmentUploadInternalResponse>> {
    const operation = 'startTaskAttachmentUploadInternal';
    const options: InternalRequestInit =
      key === undefined
        ? { idempotent: false }
        : { headers: { 'Idempotency-Key': key }, idempotent: false };
    const answer = await answered(
      STORAGE_SERVICE,
      operation,
      this.routes.startTaskAttachmentUploadInternal(
        taskKey,
        request(operation, StartTaskAttachmentUploadInternalBody, body),
        options,
      ),
    );
    const upload = expectBody(
      STORAGE_SERVICE,
      operation,
      answer,
      201,
      StartTaskAttachmentUploadInternalResponse,
    );
    noStore(operation, answer);
    const expected = `/internal/v1/tasks/${taskKey}/attachments/${upload.id}`;
    if (answer.headers.get('Location')?.toLowerCase() !== expected.toLowerCase()) {
      throw outsideContract(STORAGE_SERVICE, operation, 'an inconsistent attachment Location');
    }
    return upload;
  }

  /** Reads attachment metadata and verifies its ETag. */
  public async getTaskAttachment(
    taskKey: string,
    attachmentId: string,
  ): Promise<z.output<typeof GetTaskAttachmentInternalResponse>> {
    const operation = 'getTaskAttachmentInternal';
    const answer = await answered(
      STORAGE_SERVICE,
      operation,
      this.routes.getTaskAttachmentInternal(taskKey, attachmentId, SEND_ONCE),
    );
    const body = expectBody(
      STORAGE_SERVICE,
      operation,
      answer,
      200,
      GetTaskAttachmentInternalResponse,
    );
    if (body.taskKey !== taskKey || body.id.toLowerCase() !== attachmentId.toLowerCase()) {
      throw outsideContract(STORAGE_SERVICE, operation, 'an inconsistent attachment identity');
    }
    versioned(operation, answer, body.version);
    return body;
  }

  /** Completes an upload without retrying a state-changing request. */
  public async completeTaskAttachmentUpload(
    taskKey: string,
    attachmentId: string,
  ): Promise<z.output<typeof CompleteTaskAttachmentUploadInternalResponse>> {
    const operation = 'completeTaskAttachmentUploadInternal';
    const options: InternalRequestInit = { idempotent: false };
    const answer = await answered(
      STORAGE_SERVICE,
      operation,
      this.routes.completeTaskAttachmentUploadInternal(taskKey, attachmentId, options),
    );
    const body = expectBody(
      STORAGE_SERVICE,
      operation,
      answer,
      200,
      CompleteTaskAttachmentUploadInternalResponse,
    );
    if (body.taskKey !== taskKey || body.id.toLowerCase() !== attachmentId.toLowerCase()) {
      throw outsideContract(STORAGE_SERVICE, operation, 'an inconsistent attachment identity');
    }
    versioned(operation, answer, body.version);
    return body;
  }

  /** Obtains a non-cacheable signed download capability. */
  public async getTaskAttachmentDownload(
    taskKey: string,
    attachmentId: string,
  ): Promise<z.output<typeof GetTaskAttachmentDownloadInternalResponse>> {
    const operation = 'getTaskAttachmentDownloadInternal';
    const answer = await answered(
      STORAGE_SERVICE,
      operation,
      this.routes.getTaskAttachmentDownloadInternal(taskKey, attachmentId, SEND_ONCE),
    );
    const body = expectBody(
      STORAGE_SERVICE,
      operation,
      answer,
      200,
      GetTaskAttachmentDownloadInternalResponse,
    );
    noStore(operation, answer);
    return body;
  }

  /** Deletes once and relays the caller's optional version precondition. */
  public async deleteTaskAttachment(
    taskKey: string,
    attachmentId: string,
    ifMatch?: string,
  ): Promise<void> {
    const operation = 'deleteTaskAttachmentInternal';
    const options: InternalRequestInit = {
      idempotent: false,
      ...(ifMatch === undefined ? {} : { headers: { 'If-Match': ifMatch } }),
    };
    const answer = await answered(
      STORAGE_SERVICE,
      operation,
      this.routes.deleteTaskAttachmentInternal(taskKey, attachmentId, options),
    );
    expectStatus(STORAGE_SERVICE, operation, answer, 204);
  }

  /** Reads the private largest-files page for an authorized quota use case. */
  public async listLargestAttachments(
    query: unknown,
  ): Promise<z.output<typeof ListLargestAttachmentsInternalResponse>> {
    const operation = 'listLargestAttachmentsInternal';
    const answer = await answered(
      STORAGE_SERVICE,
      operation,
      this.routes.listLargestAttachmentsInternal(
        request(operation, ListLargestAttachmentsInternalQueryParams, query),
      ),
    );
    return expectBody(
      STORAGE_SERVICE,
      operation,
      answer,
      200,
      ListLargestAttachmentsInternalResponse,
    );
  }
  // #endregion
}

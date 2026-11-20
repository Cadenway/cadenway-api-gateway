import {
  CompleteIntakeAttachmentUploadInternalParams,
  CompleteIntakeAttachmentUploadInternalResponse,
  CompleteTaskAttachmentUploadInternalResponse,
  GetAvatarImageInternalParams,
  GetAvatarImageInternalQueryParams,
  GetOrganizationLogoImageInternalParams,
  GetTaskAttachmentDownloadInternalResponse,
  GetTaskAttachmentInternalResponse,
  ListLargestAttachmentsInternalQueryParams,
  ListLargestAttachmentsInternalResponse,
  ListTaskAttachmentsInternalQueryParams,
  ListTaskAttachmentsInternalResponse,
  PrepareProfileMediaInternalBody,
  PrepareProfileMediaInternalParams,
  PrepareProfileMediaInternalResponse,
  SignProfileMediaTransferInternalBody,
  SignProfileMediaTransferInternalParams,
  SignProfileMediaTransferInternalResponse,
  StartIntakeAttachmentUploadInternalBody,
  StartIntakeAttachmentUploadInternalParams,
  StartIntakeAttachmentUploadInternalResponse,
  StartTaskAttachmentUploadInternalBody,
  StartTaskAttachmentUploadInternalResponse,
} from '@cadenway/contracts/validators/internal/storage-service';
import type { ResolveIntakeAttachmentInternalResponse } from '@cadenway/contracts/validators/internal/task-service';
import { getOrganizationContext, ProblemException } from '@cadenway/nest-common';
import type { InternalHttpClient, InternalRequestInit } from '@cadenway/nest-common';
import { trace } from '@opentelemetry/api';
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
type IntakeAllocation = z.output<typeof ResolveIntakeAttachmentInternalResponse>;
const SEND_ONCE: InternalRequestInit = { idempotent: false };
const PROFILE_MEDIA_IMAGE_PATH = /^\/internal\/v1\/(?:avatars|organization\/logo-assets)\//u;
const MAX_PROFILE_PNG_BYTES = 5 * 1024 * 1024;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

/** The verified scope used to authorize the profile media operation. */
export type ProfileMediaStorageScope = 'account' | 'organization';

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

/** Signs a single Storage call for the tenant proved by Task without applicant credentials. */
function intakeStorageRequest(organizationId: string): InternalRequestInit {
  const traceId = trace.getActiveSpan()?.spanContext().traceId;
  return {
    idempotent: false,
    claims: {
      actor: { type: 'system', id: null },
      organizationId,
      role: null,
      scopes: [],
      ...(traceId === undefined ? {} : { traceId }),
    },
  };
}

/** Allows only a browser form destination without user information or a fragment. */
function isUploadUrl(value: string): boolean {
  const url = URL.parse(value);
  return (
    url !== null &&
    /^https?:\/\/[^/?#@]+(?:[/?]|$)/iu.test(value) &&
    !/[\s\\#]/u.test(value) &&
    url.username === '' &&
    url.password === ''
  );
}

/** Keeps avatar account access unscoped even when the session has a selected organization. */
function mediaRequest(scope: ProfileMediaStorageScope, idempotent: boolean): InternalRequestInit {
  if (scope === 'organization') {
    return { idempotent };
  }
  const context = getOrganizationContext();
  if (context?.actor.type !== 'user') {
    throw new Error('An account profile media call requires the verified user.');
  }
  const traceId = trace.getActiveSpan()?.spanContext().traceId;
  return {
    idempotent,
    claims: {
      actor: context.actor,
      organizationId: null,
      role: null,
      scopes: [],
      ...(traceId === undefined ? {} : { traceId }),
    },
  };
}

/** Bounds the upstream stream before Orval accumulates the binary response as a Blob. */
function boundedProfilePng(response: Response): Response {
  const headers = response.headers;
  const body = response.body;
  const length = headers.get('Content-Length');
  if (
    body === null ||
    headers.get('Content-Type')?.toLowerCase() !== 'image/png' ||
    headers.get('Cache-Control')?.toLowerCase() !== 'private, no-store' ||
    headers.get('X-Content-Type-Options')?.toLowerCase() !== 'nosniff' ||
    (length !== null && (!/^[1-9][0-9]*$/u.test(length) || Number(length) > MAX_PROFILE_PNG_BYTES))
  ) {
    void body?.cancel().catch(() => undefined);
    throw outsideContract(STORAGE_SERVICE, 'readProfilePng', 'invalid PNG response headers');
  }
  let received = 0;
  const bounded = body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        received += chunk.byteLength;
        if (received > MAX_PROFILE_PNG_BYTES) {
          throw outsideContract(STORAGE_SERVICE, 'readProfilePng', 'PNG exceeds its byte limit');
        }
        controller.enqueue(chunk);
      },
      flush() {
        if (length !== null && received !== Number(length)) {
          throw outsideContract(STORAGE_SERVICE, 'readProfilePng', 'PNG length did not match');
        }
      },
    }),
  );
  return new Response(bounded, { status: response.status, headers });
}

/** Verifies and returns the bounded PNG bytes to the owning public route. */
async function profilePng(operation: string, answer: StorageAnswer): Promise<Buffer> {
  expectStatus(STORAGE_SERVICE, operation, answer, 200);
  if (!(answer.data instanceof Blob)) {
    throw outsideContract(STORAGE_SERVICE, operation, 'missing PNG response');
  }
  const bytes = Buffer.from(await answer.data.arrayBuffer());
  if (!bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw outsideContract(STORAGE_SERVICE, operation, 'invalid PNG signature');
  }
  return bytes;
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
        const response = await http.fetch(input, init);
        return response.status === 200 && PROFILE_MEDIA_IMAGE_PATH.test(input)
          ? boundedProfilePng(response)
          : response;
      },
    );
  }
  // #endregion

  // #region Methods
  /** Relays the capability for the declaration and expiry verified by the owner. */
  public async signProfileMediaTransfer(
    uploadId: string,
    body: object,
    scope: ProfileMediaStorageScope,
  ): Promise<z.output<typeof SignProfileMediaTransferInternalResponse>> {
    const operation = 'signProfileMediaTransferInternal';
    request(operation, SignProfileMediaTransferInternalParams, { uploadId });
    const approved = SignProfileMediaTransferInternalBody.safeParse(body);
    if (!approved.success) {
      throw outsideContract(STORAGE_SERVICE, operation, 'the approved declaration is inconsistent');
    }
    const answer = await answered(
      STORAGE_SERVICE,
      operation,
      this.routes.signProfileMediaTransferInternal(
        uploadId,
        approved.data,
        mediaRequest(scope, false),
      ),
    );
    expectStatus(STORAGE_SERVICE, operation, answer, 200);
    noStore(operation, answer);
    const parsed = SignProfileMediaTransferInternalResponse.safeParse(answer.data);
    if (
      !parsed.success ||
      parsed.data.uploadId.toLowerCase() !== uploadId.toLowerCase() ||
      Date.parse(parsed.data.expiresAt) !== Date.parse(approved.data.expiresAt) ||
      !isUploadUrl(parsed.data.url)
    ) {
      throw outsideContract(STORAGE_SERVICE, operation, 'an invalid signed transfer response');
    }
    return parsed.data;
  }

  /** Prepares only the upload whose pending owner state has been verified. */
  public async prepareProfileMedia(
    uploadId: string,
    body: object,
    scope: ProfileMediaStorageScope,
  ): Promise<z.output<typeof PrepareProfileMediaInternalResponse>> {
    const operation = 'prepareProfileMediaInternal';
    request(operation, PrepareProfileMediaInternalParams, { uploadId });
    const preparation = request(operation, PrepareProfileMediaInternalBody, body);
    const answer = await answered(
      STORAGE_SERVICE,
      operation,
      this.routes.prepareProfileMediaInternal(uploadId, preparation, mediaRequest(scope, false)),
    );
    const image = expectBody(
      STORAGE_SERVICE,
      operation,
      answer,
      200,
      PrepareProfileMediaInternalResponse,
    );
    if (image.uploadId.toLowerCase() !== uploadId.toLowerCase() || image.width !== image.height) {
      throw outsideContract(STORAGE_SERVICE, operation, 'an inconsistent verified derivative');
    }
    return image;
  }

  /** Reads the private derivative belonging to the authorized target account. */
  public async getAvatarImage(
    assetId: string,
    ownerUserId: string,
    scope: ProfileMediaStorageScope,
  ): Promise<Buffer> {
    const operation = 'getAvatarImageInternal';
    if (!GetAvatarImageInternalParams.safeParse({ assetId }).success) {
      throw outsideContract(STORAGE_SERVICE, operation, 'an unusable avatar reference');
    }
    const query = request(operation, GetAvatarImageInternalQueryParams, { ownerUserId });
    const answer = await answered(
      STORAGE_SERVICE,
      operation,
      this.routes.getAvatarImageInternal(assetId, query, mediaRequest(scope, true)),
    );
    return profilePng(operation, answer);
  }

  /** Reads the current immutable logo in the organization proved by the live owner lookup. */
  public async getOrganizationLogoImage(assetId: string): Promise<Buffer> {
    const operation = 'getOrganizationLogoImageInternal';
    if (!GetOrganizationLogoImageInternalParams.safeParse({ assetId }).success) {
      throw outsideContract(STORAGE_SERVICE, operation, 'an unusable logo reference');
    }
    const answer = await answered(
      STORAGE_SERVICE,
      operation,
      this.routes.getOrganizationLogoImageInternal(assetId),
    );
    return profilePng(operation, answer);
  }

  /** Signs an applicant upload using only the allocation received from Task. */
  public async startIntakeAttachmentUpload(
    proof: IntakeAllocation,
    body: object,
  ): Promise<z.output<typeof StartIntakeAttachmentUploadInternalResponse>> {
    const operation = 'startIntakeAttachmentUploadInternal';
    const { organizationId, publicationId, attachmentId, expiresAt } = proof;
    request(operation, StartIntakeAttachmentUploadInternalParams, { publicationId });
    const answer = await answered(
      STORAGE_SERVICE,
      operation,
      this.routes.startIntakeAttachmentUploadInternal(
        publicationId,
        request(operation, StartIntakeAttachmentUploadInternalBody, {
          ...body,
          attachmentId,
          expiresAt,
        }),
        intakeStorageRequest(organizationId),
      ),
    );
    expectStatus(STORAGE_SERVICE, operation, answer, 201);
    noStore(operation, answer);
    // A validator issue can name an arbitrary member of the signed form, so use a static error.
    const parsed = StartIntakeAttachmentUploadInternalResponse.safeParse(answer.data);
    if (!parsed.success) {
      throw outsideContract(STORAGE_SERVICE, operation, 'an invalid signed upload response');
    }
    const upload = parsed.data;
    const location = `/internal/v1/intake-publications/${publicationId}/attachments/${attachmentId}`;
    if (
      upload.id.toLowerCase() !== attachmentId.toLowerCase() ||
      answer.headers.get('Location')?.toLowerCase() !== location.toLowerCase() ||
      !(Date.parse(upload.expiresAt) <= Date.parse(expiresAt)) ||
      !isUploadUrl(upload.url)
    ) {
      throw outsideContract(STORAGE_SERVICE, operation, 'an inconsistent signed upload response');
    }
    return upload;
  }

  /** Verifies only the reservation and tenant authorized by the current Task lookup. */
  public async completeIntakeAttachmentUpload(
    proof: IntakeAllocation,
  ): Promise<z.output<typeof CompleteIntakeAttachmentUploadInternalResponse>> {
    const operation = 'completeIntakeAttachmentUploadInternal';
    const { organizationId, publicationId, attachmentId } = proof;
    request(operation, CompleteIntakeAttachmentUploadInternalParams, {
      publicationId,
      attachmentId,
    });
    const answer = await answered(
      STORAGE_SERVICE,
      operation,
      this.routes.completeIntakeAttachmentUploadInternal(
        publicationId,
        attachmentId,
        intakeStorageRequest(organizationId),
      ),
    );
    const completion = expectBody(
      STORAGE_SERVICE,
      operation,
      answer,
      200,
      CompleteIntakeAttachmentUploadInternalResponse,
    );
    noStore(operation, answer);
    if (completion.id.toLowerCase() !== attachmentId.toLowerCase()) {
      throw outsideContract(STORAGE_SERVICE, operation, 'an inconsistent completion identity');
    }
    return completion;
  }

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

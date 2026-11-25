import {
  CreateDocumentBody,
  CreateDocumentHeader,
  CreateDocumentResponse,
  DeleteDocumentHeader,
  DeleteDocumentParams,
  GetDocumentParams,
  GetDocumentResponse,
  ListDocumentsQueryParams,
  ListDocumentsResponse,
  UpdateDocumentBody,
  UpdateDocumentHeader,
  UpdateDocumentParams,
  UpdateDocumentResponse,
} from '@cadenway/contracts/validators/public/documents';
import { formatEtag, ProblemException, ZodValidationPipe } from '@cadenway/nest-common';
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

import { conformBody, outsideContract } from '../../../../../../problems/upstream-answer.js';
import {
  relayProblems,
  type AcceptedProblems,
} from '../../../../../../problems/upstream-problem.js';
import { RequiredBody } from '../../../../../../presentation/http/mappers/request-body.mapper.js';
import { toRequestHeader } from '../../../../../../presentation/http/mappers/request-headers.mapper.js';
import { CredentialGuard } from '../../../../../auth/public/credential/credential-guard.js';
import { RateLimitGuard } from '../../../../../rate-limit/public/requests/rate-limit-guard.js';
import { CreateDocument } from '../../../../application/use-cases/commands/documents/create-document/create-document.use-case.js';
import { DeleteDocument } from '../../../../application/use-cases/commands/documents/delete-document/delete-document.use-case.js';
import { UpdateDocument } from '../../../../application/use-cases/commands/documents/update-document/update-document.use-case.js';
import { GetDocument } from '../../../../application/use-cases/queries/documents/get-document/get-document.use-case.js';
import { ListDocuments } from '../../../../application/use-cases/queries/documents/list-documents/list-documents.use-case.js';

const READ: AcceptedProblems = {
  400: ['request.invalid'],
  404: ['organization.not-found', 'document.not-found'],
  503: ['document.unavailable'],
};
const LIST: AcceptedProblems = {
  400: ['request.invalid'],
  404: ['organization.not-found'],
};
const WRITE: AcceptedProblems = {
  ...READ,
  400: ['request.invalid', 'request.body-too-large'],
  403: ['access.role-insufficient'],
  412: ['request.version-mismatch'],
};
const CREATE: AcceptedProblems = {
  400: ['request.invalid', 'request.body-too-large'],
  403: ['access.role-insufficient'],
  404: ['organization.not-found', 'space.not-found', 'document.not-found'],
  409: ['idempotency.request-in-progress'],
  422: ['idempotency.key-reused'],
};

/** The published JSON Merge Patch requires at least one property. */
const DocumentPatch = UpdateDocumentBody.refine((body) => Object.keys(body).length > 0, {
  message: 'At least one field is required.',
});

/** Translates dependency failures to the public Document contract without internal details. */
async function relayDocument<T>(accepted: AcceptedProblems, call: () => Promise<T>): Promise<T> {
  try {
    return await relayProblems(accepted, call, [404]);
  } catch (error) {
    if (!(error instanceof ProblemException) || error.problem.status !== 503) throw error;
    const code = error.problem.code;
    const allowed = [
      'document.unavailable',
      'upstream.failed',
      'upstream.unauthorized',
      'upstream.unreachable',
      'upstream.timeout',
    ];
    throw new ProblemException({
      status: 503,
      code:
        code === 'upstream.deadline-exceeded'
          ? 'upstream.timeout'
          : allowed.includes(code)
            ? code
            : 'upstream.failed',
    });
  }
}

/** Public Document routes for a verified organization session. */
@Controller('v1/documents')
@UseGuards(CredentialGuard, RateLimitGuard)
export class DocumentsController {
  // #region Constructor
  /** Binds document operations. */
  public constructor(
    @Inject(ListDocuments) private readonly listing: ListDocuments,
    @Inject(CreateDocument) private readonly creating: CreateDocument,
    @Inject(GetDocument) private readonly getting: GetDocument,
    @Inject(UpdateDocument) private readonly updating: UpdateDocument,
    @Inject(DeleteDocument) private readonly deleting: DeleteDocument,
  ) {}
  // #endregion

  // #region Methods
  /** Lists visible document metadata. */
  @Get()
  @CredentialGuard.requires({
    operationId: 'listDocuments',
    security: [{ sessionCookie: [] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async list(
    @Query(new ZodValidationPipe(ListDocumentsQueryParams.strict()))
    query: z.output<typeof ListDocumentsQueryParams>,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof ListDocumentsResponse>> {
    const result = conformBody(
      'document-service',
      'listDocuments',
      ListDocumentsResponse,
      await relayDocument(LIST, () => this.listing.execute(query)),
    );
    response.setHeader('Cache-Control', 'private, no-store');
    return result;
  }

  /** Creates a document or replays its authorized creation. */
  @Post()
  @HttpCode(201)
  @CredentialGuard.requires({
    operationId: 'createDocument',
    security: [{ sessionCookie: [] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async create(
    @RequiredBody(CreateDocumentBody) body: z.output<typeof CreateDocumentBody>,
    @Headers('idempotency-key') header: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof CreateDocumentResponse>> {
    const key = toRequestHeader(
      'Idempotency-Key',
      CreateDocumentHeader.shape['Idempotency-Key'],
      header,
    );
    const result = conformBody(
      'document-service',
      'createDocument',
      CreateDocumentResponse,
      await relayDocument(CREATE, () => this.creating.execute(body, key)),
    );
    if (result.spaceId.toLowerCase() !== body.spaceId.toLowerCase()) {
      throw outsideContract(
        'document-service',
        'createDocument',
        'a document outside the requested space',
      );
    }
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('ETag', formatEtag(result.version));
    response.setHeader('Location', `/v1/documents/${result.id}`);
    return result;
  }

  /** Reads the latest document under current access. */
  @Get(':documentId')
  @CredentialGuard.requires({
    operationId: 'getDocument',
    security: [{ sessionCookie: [] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async get(
    @Param(new ZodValidationPipe(GetDocumentParams)) params: z.output<typeof GetDocumentParams>,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof GetDocumentResponse>> {
    const result = conformBody(
      'document-service',
      'getDocument',
      GetDocumentResponse,
      await relayDocument(READ, () => this.getting.execute(params.documentId)),
    );
    if (result.id.toLowerCase() !== params.documentId.toLowerCase()) {
      throw outsideContract('document-service', 'getDocument', 'a different document');
    }
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('ETag', formatEtag(result.version));
    return result;
  }

  /** Saves supplied source fields against the current strong version. */
  @Patch(':documentId')
  @CredentialGuard.requires({
    operationId: 'updateDocument',
    security: [{ sessionCookie: [] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async update(
    @Param(new ZodValidationPipe(UpdateDocumentParams))
    params: z.output<typeof UpdateDocumentParams>,
    @RequiredBody(DocumentPatch) body: z.output<typeof UpdateDocumentBody>,
    @Headers('if-match') header: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof UpdateDocumentResponse>> {
    const ifMatch = toRequestHeader('If-Match', UpdateDocumentHeader.shape['If-Match'], header);
    const result = conformBody(
      'document-service',
      'updateDocument',
      UpdateDocumentResponse,
      await relayDocument(WRITE, () => this.updating.execute(params.documentId, body, ifMatch)),
    );
    if (result.id.toLowerCase() !== params.documentId.toLowerCase()) {
      throw outsideContract('document-service', 'updateDocument', 'a different document');
    }
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('ETag', formatEtag(result.version));
    return result;
  }

  /** Deletes the current document under its strong version. */
  @Delete(':documentId')
  @HttpCode(204)
  @CredentialGuard.requires({
    operationId: 'deleteDocument',
    security: [{ sessionCookie: [] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async remove(
    @Param(new ZodValidationPipe(DeleteDocumentParams))
    params: z.output<typeof DeleteDocumentParams>,
    @Headers('if-match') header: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const ifMatch = toRequestHeader('If-Match', DeleteDocumentHeader.shape['If-Match'], header);
    await relayDocument(WRITE, () => this.deleting.execute(params.documentId, ifMatch));
    response.setHeader('Cache-Control', 'private, no-store');
  }
  // #endregion
}

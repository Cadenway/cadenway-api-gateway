import {
  DeleteAvatarHeader,
  DeleteOrganizationLogoHeader,
  GetMemberAvatarParams,
  SetAvatarBody,
  SetAvatarHeader,
  SetOrganizationLogoBody,
  SetOrganizationLogoHeader,
  StartAvatarUploadHeader,
  StartAvatarUploadResponse,
  StartOrganizationLogoUploadHeader,
  StartOrganizationLogoUploadResponse,
} from '@cadenway/contracts/validators/public/profile-media';
import { ProblemException, ZodValidationPipe } from '@cadenway/nest-common';
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
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { z } from 'zod';

import { conformBody } from '../../../../../../problems/upstream-answer.js';
import {
  relayProblems,
  toPublicProblem,
  type AcceptedProblems,
} from '../../../../../../problems/upstream-problem.js';
import { RequiredBody } from '../../../../../../presentation/http/mappers/request-body.mapper.js';
import { toRequestHeader } from '../../../../../../presentation/http/mappers/request-headers.mapper.js';
import { verifiedCredentialOf } from '../../../../../../presentation/http/session/request-session.js';
import { CredentialGuard } from '../../../../../auth/public/credential/credential-guard.js';
import { RateLimitGuard } from '../../../../../rate-limit/public/requests/rate-limit-guard.js';
import { StartAvatar } from '../../../../application/use-cases/commands/profile-media/start-avatar/start-avatar.use-case.js';
import { SetAvatar } from '../../../../application/use-cases/commands/profile-media/set-avatar/set-avatar.use-case.js';
import { DeleteAvatar } from '../../../../application/use-cases/commands/profile-media/delete-avatar/delete-avatar.use-case.js';
import { StartLogo } from '../../../../application/use-cases/commands/profile-media/start-logo/start-logo.use-case.js';
import { SetLogo } from '../../../../application/use-cases/commands/profile-media/set-logo/set-logo.use-case.js';
import { DeleteLogo } from '../../../../application/use-cases/commands/profile-media/delete-logo/delete-logo.use-case.js';
import { GetAvatar } from '../../../../application/use-cases/queries/profile-media/get-avatar/get-avatar.use-case.js';
import { GetLogo } from '../../../../application/use-cases/queries/profile-media/get-logo/get-logo.use-case.js';
import { GetMemberAvatar } from '../../../../application/use-cases/queries/profile-media/get-member-avatar/get-member-avatar.use-case.js';

const AVATAR_READ: AcceptedProblems = {
  400: ['request.invalid'],
  404: ['user.not-found', 'media.not-found'],
};
const LOGO_READ: AcceptedProblems = {
  400: ['request.invalid'],
  404: ['organization.not-found', 'media.not-found'],
};
const LOGO_WRITE: AcceptedProblems = { ...LOGO_READ, 403: ['organization.role-forbidden'] };
const MEMBER_READ: AcceptedProblems = {
  400: ['request.invalid'],
  403: ['organization.role-forbidden'],
  404: ['organization.not-found', 'member.not-found', 'media.not-found'],
};
const START = {
  409: ['idempotency.request-in-progress', 'media.upload-expired'],
  422: ['media.file-too-large', 'media.unsupported-type', 'idempotency.key-reused'],
} satisfies AcceptedProblems;
const UPDATE = {
  409: ['media.upload-expired', 'media.upload-not-ready', 'media.upload-superseded'],
  412: ['request.version-mismatch'],
  422: ['media.file-too-large', 'media.unsupported-type', 'media.invalid-image'],
} satisfies AcceptedProblems;
const REMOVE = { 412: ['request.version-mismatch'] } satisfies AcceptedProblems;
const DECLARATION = z.strictObject({
  contentType: z.string(),
  sizeBytes: z.number().positive().refine(Number.isInteger),
});

/** Reads the actor attached by the credential guard. */
function userOf(request: Request): string {
  const credential = verifiedCredentialOf(request);
  if (credential === undefined) throw new Error('The media route requires a verified credential.');
  return credential.userId;
}

/** Emits a verified PNG without Express conditional-response rewriting. */
function sendImage(response: Response, bytes: Buffer | null): void {
  if (bytes === null) throw new ProblemException({ status: 404, code: 'media.not-found' });
  response.setHeader('Cache-Control', 'private, no-store');
  response.setHeader('Content-Type', 'image/png');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.status(200).end(bytes);
}

/** Public account avatar, organization logo and member avatar operations. */
@Controller('v1')
@UseGuards(CredentialGuard, RateLimitGuard)
export class ProfileMediaController {
  // #region Constructor
  /** Binds the image orchestration use case. */
  public constructor(
    @Inject(StartAvatar) private readonly startAvatarUseCase: StartAvatar,
    @Inject(SetAvatar) private readonly setAvatarUseCase: SetAvatar,
    @Inject(DeleteAvatar) private readonly deleteAvatarUseCase: DeleteAvatar,
    @Inject(StartLogo) private readonly startLogoUseCase: StartLogo,
    @Inject(SetLogo) private readonly setLogoUseCase: SetLogo,
    @Inject(DeleteLogo) private readonly deleteLogoUseCase: DeleteLogo,
    @Inject(GetAvatar) private readonly getAvatarUseCase: GetAvatar,
    @Inject(GetLogo) private readonly getLogoUseCase: GetLogo,
    @Inject(GetMemberAvatar) private readonly getMemberAvatarUseCase: GetMemberAvatar,
  ) {}
  // #endregion

  // #region Methods
  /** Reserves the current account's avatar upload. */
  @Post('me/avatar/uploads')
  @CredentialGuard.requires({
    operationId: 'startAvatarUpload',
    security: [{ sessionCookie: [] }],
    organization: false,
  })
  public async startAvatar(
    @Req() request: Request,
    @RequiredBody(DECLARATION) body: z.output<typeof DECLARATION>,
    @Headers('idempotency-key') header: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof StartAvatarUploadResponse>> {
    const key = toRequestHeader(
      'Idempotency-Key',
      StartAvatarUploadHeader.shape['Idempotency-Key'],
      header,
    );
    const result = conformBody(
      'storage-service',
      'startAvatarUpload',
      StartAvatarUploadResponse,
      await relayProblems(
        { ...AVATAR_READ, ...START },
        () => this.startAvatarUseCase.execute(userOf(request), body, key),
        [404],
      ),
    );
    response.setHeader('Location', `/v1/me/avatar/uploads/${result.uploadId}`);
    response.setHeader('Cache-Control', 'no-store');
    return result;
  }

  /** Reads the current account avatar. */
  @Get('me/avatar')
  @CredentialGuard.requires({
    operationId: 'getAvatar',
    security: [{ sessionCookie: [] }],
    organization: false,
  })
  public async getAvatar(@Req() request: Request, @Res() response: Response): Promise<void> {
    sendImage(
      response,
      await relayProblems(AVATAR_READ, () => this.getAvatarUseCase.execute(userOf(request)), [404]),
    );
  }

  /** Publishes or replays the account avatar. */
  @Put('me/avatar')
  @HttpCode(204)
  @CredentialGuard.requires({
    operationId: 'setAvatar',
    security: [{ sessionCookie: [] }],
    organization: false,
  })
  public async setAvatar(
    @Req() request: Request,
    @RequiredBody(SetAvatarBody) body: z.output<typeof SetAvatarBody>,
    @Headers('if-match') header: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const ifMatch = toRequestHeader('If-Match', SetAvatarHeader.shape['If-Match'], header);
    const etag = await relayProblems(
      { ...AVATAR_READ, ...UPDATE },
      () => this.setAvatarUseCase.execute(userOf(request), body.uploadId, ifMatch),
      [404],
    );
    response.setHeader('ETag', etag);
  }

  /** Clears the account avatar. */
  @Delete('me/avatar')
  @HttpCode(204)
  @CredentialGuard.requires({
    operationId: 'deleteAvatar',
    security: [{ sessionCookie: [] }],
    organization: false,
  })
  public async deleteAvatar(
    @Req() request: Request,
    @Headers('if-match') header: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const ifMatch = toRequestHeader('If-Match', DeleteAvatarHeader.shape['If-Match'], header);
    const etag = await relayProblems(
      { ...AVATAR_READ, ...REMOVE },
      () => this.deleteAvatarUseCase.execute(userOf(request), ifMatch),
      [404],
    );
    response.setHeader('ETag', etag);
  }

  /** Reserves a logo after the owner's authorization check. */
  @Post('organization/logo/uploads')
  @CredentialGuard.requires({
    operationId: 'startOrganizationLogoUpload',
    security: [{ sessionCookie: [] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async startLogo(
    @RequiredBody(DECLARATION) body: z.output<typeof DECLARATION>,
    @Headers('idempotency-key') header: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<z.output<typeof StartOrganizationLogoUploadResponse>> {
    const key = toRequestHeader(
      'Idempotency-Key',
      StartOrganizationLogoUploadHeader.shape['Idempotency-Key'],
      header,
    );
    const result = conformBody(
      'storage-service',
      'startOrganizationLogoUpload',
      StartOrganizationLogoUploadResponse,
      await relayProblems(
        { ...LOGO_WRITE, ...START },
        () => this.startLogoUseCase.execute(body, key),
        [404],
      ),
    );
    response.setHeader('Location', `/v1/organization/logo/uploads/${result.uploadId}`);
    response.setHeader('Cache-Control', 'no-store');
    return result;
  }

  /** Reads the current organization's logo. */
  @Get('organization/logo')
  @CredentialGuard.requires({
    operationId: 'getOrganizationLogo',
    security: [{ sessionCookie: [] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async getLogo(@Res() response: Response): Promise<void> {
    sendImage(response, await relayProblems(LOGO_READ, () => this.getLogoUseCase.execute(), [404]));
  }

  /** Publishes or replays the organization logo. */
  @Put('organization/logo')
  @HttpCode(204)
  @CredentialGuard.requires({
    operationId: 'setOrganizationLogo',
    security: [{ sessionCookie: [] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async setLogo(
    @RequiredBody(SetOrganizationLogoBody) body: z.output<typeof SetOrganizationLogoBody>,
    @Headers('if-match') header: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const ifMatch = toRequestHeader(
      'If-Match',
      SetOrganizationLogoHeader.shape['If-Match'],
      header,
    );
    const etag = await relayProblems(
      { ...LOGO_WRITE, ...UPDATE },
      () => this.setLogoUseCase.execute(body.uploadId, ifMatch),
      [404],
    );
    response.setHeader('ETag', etag);
  }

  /** Clears the organization logo. */
  @Delete('organization/logo')
  @HttpCode(204)
  @CredentialGuard.requires({
    operationId: 'deleteOrganizationLogo',
    security: [{ sessionCookie: [] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async deleteLogo(
    @Headers('if-match') header: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const ifMatch = toRequestHeader(
      'If-Match',
      DeleteOrganizationLogoHeader.shape['If-Match'],
      header,
    );
    const etag = await relayProblems(
      { ...LOGO_WRITE, ...REMOVE },
      () => this.deleteLogoUseCase.execute(ifMatch),
      [404],
    );
    response.setHeader('ETag', etag);
  }

  /** Reads a live member's current avatar. */
  @Get('members/:memberId/avatar')
  @CredentialGuard.requires({
    operationId: 'getMemberAvatar',
    security: [{ sessionCookie: [] }, { apiToken: ['members:read'] }],
    organization: true,
    organizationPrecondition: true,
  })
  public async getMemberAvatar(
    @Param(new ZodValidationPipe(GetMemberAvatarParams))
    params: z.output<typeof GetMemberAvatarParams>,
    @Res() response: Response,
  ): Promise<void> {
    try {
      sendImage(response, await this.getMemberAvatarUseCase.execute(params.memberId));
    } catch (error) {
      throw toPublicProblem(error, MEMBER_READ, { 'user.not-found': 'media.not-found' }, [404]);
    }
  }
  // #endregion
}

import { GetTaskDetailHeader } from '@cadenway/contracts/validators/public/tasks';
import { requireOrganizationId } from '@cadenway/nest-common';
import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Observable } from 'rxjs';

import { publicProblem } from '../../../problems/public-problem.js';
import { toRequestHeader } from '../mappers/request-headers.mapper.js';

/**
 * Checks the caller's expected organization after authentication, CSRF, scope and rate limiting.
 * The request header never selects the context used by downstream calls.
 */
@Injectable()
export class OrganizationPreconditionInterceptor implements NestInterceptor {
  // #region Methods
  /** Rejects an invalid or stale precondition before invoking the handler. */
  public intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    // Node combines repeated fields with a comma, which the shared UUIDv7 validator rejects.
    const expected = toRequestHeader(
      'If-Organization-Match',
      GetTaskDetailHeader.shape['If-Organization-Match'],
      request.headers['if-organization-match'],
      { singleIssue: true },
    );
    if (
      expected !== undefined &&
      expected.toLowerCase() !== requireOrganizationId().toLowerCase()
    ) {
      http.getResponse<Response>().setHeader('Cache-Control', 'private, no-store');
      throw publicProblem({ status: 412, code: 'organization.context-changed' });
    }
    return next.handle();
  }
  // #endregion
}

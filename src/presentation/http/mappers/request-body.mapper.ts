import { ProblemException, ZodValidationPipe } from '@cadenway/nest-common';
import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { IncomingHttpHeaders } from 'node:http';
import type { z } from 'zod';

/**
 * Interface JsonRequest
 *
 * @description
 * The parts of an HTTP request the check of a required body reads; an Express request
 * satisfies it.
 */
interface JsonRequest {
  // #region Properties
  /**
   * Property headers
   *
   * @description
   * Headers of the request, `Content-Length` among them.
   *
   * @type {IncomingHttpHeaders}
   * @readonly
   */
  readonly headers: IncomingHttpHeaders;

  /**
   * Property body
   *
   * @description
   * The body as the JSON parser of the kit left it: `undefined` when the request has no body or
   * a media type other than JSON, `{}` for a zero-byte JSON body.
   *
   * @type {unknown}
   * @readonly
   */
  readonly body?: unknown;
  // #endregion
}

/**
 * Interface RequiredBodyOptions
 *
 * @description
 * Data of the parameter decorator behind `RequiredBody`. The validator sits under its own key:
 * NestJS would take a zod schema given directly for a pipe (it has a `transform` method), and an
 * object holding only `schema` for its own parameter options.
 */
interface RequiredBodyOptions {
  // #region Properties
  /**
   * Property contract
   *
   * @description
   * Validator of the body in the public contract.
   *
   * @type {z.ZodType}
   * @readonly
   */
  readonly contract: z.ZodType;
  // #endregion
}

/**
 * Constant MISSING_BODY_ISSUE
 *
 * @description
 * The single `details.issues` entry of a missing body: the body itself, with no path.
 *
 * @type {Readonly<Record<string, string>>}
 */
const MISSING_BODY_ISSUE: Readonly<Record<string, string>> = Object.freeze({
  in: 'body',
  path: '',
  code: 'required',
  message: 'Expected a JSON body.',
});

/**
 * Function toRequiredBody
 *
 * @description
 * Validates the body of an operation whose contract marks `requestBody.required: true`. The JSON
 * parser of `@cadenway/nest-common` hands a zero-byte JSON body on as `{}`, which an
 * `EmptyRequest` would accept; a request that declares `Content-Length: 0` is therefore refused
 * here, before the validator. Any other body, a literal `{}` included, goes through
 * `ZodValidationPipe` exactly as `@Body(new ZodValidationPipe(contract))` takes it, so a request
 * with no body at all (`undefined`) keeps being refused by the validator.
 *
 * Limitation: an empty chunked body (`Transfer-Encoding: chunked` with no data), or an empty body
 * under a `Content-Encoding`, reaches the gateway as `{}` as well, with nothing left to tell it
 * from a literal `{}`. Telling them apart belongs to the parser of cadenway-service-kit.
 *
 * @param {JsonRequest} request - The HTTP request, after the JSON parser.
 * @param {z.ZodType} contract - Validator of the body in the public contract.
 * @returns {unknown} The body as the validator parsed it.
 * @throws {ProblemException} 400 `request.invalid` with one `details.issues` entry for the body
 *   itself (`code: required`) when the request declares a zero-byte body, or the problem of
 *   `ZodValidationPipe` when the body does not satisfy the contract.
 */
export function toRequiredBody(request: JsonRequest, contract: z.ZodType): unknown {
  if (Number(request.headers['content-length']) === 0) {
    throw new ProblemException({
      status: 400,
      code: 'request.invalid',
      detail: 'The request does not match its contract.',
      details: { issues: [MISSING_BODY_ISSUE] },
    });
  }
  return new ZodValidationPipe(contract).transform(request.body, { type: 'body' });
}

/**
 * Constant requiredBodyParameter
 *
 * @description
 * The NestJS parameter decorator `RequiredBody` configures.
 *
 * @type {(options: RequiredBodyOptions) => ParameterDecorator}
 */
const requiredBodyParameter: (options: RequiredBodyOptions) => ParameterDecorator =
  createParamDecorator((options: RequiredBodyOptions, context: ExecutionContext): unknown =>
    toRequiredBody(context.switchToHttp().getRequest<JsonRequest>(), options.contract),
  );

/**
 * Function RequiredBody
 *
 * @description
 * Route parameter decorator of a required JSON body, in place of
 * `@Body(new ZodValidationPipe(contract))`: `@RequiredBody(CreateTaskBody) body: ...`. The body
 * is checked by `toRequiredBody` after the guards and before the handler, hence before any
 * upstream call, and its validation issues keep `in: 'body'`.
 *
 * @param {z.ZodType} contract - Validator of the body in the public contract.
 * @returns {ParameterDecorator} The decorator.
 */
export function RequiredBody(contract: z.ZodType): ParameterDecorator {
  return requiredBodyParameter({ contract });
}

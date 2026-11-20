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
   * The body as the body parsers left it: `undefined` when none reads it (no body, or no media
   * type they parse), `{}` for a zero-byte JSON body or a form body such as `&`.
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
 * Constant UNSUPPORTED_MEDIA_TYPE_ISSUE
 *
 * @description
 * The single `details.issues` entry of a body sent with a media type other than JSON in UTF-8:
 * the body itself, with no path.
 *
 * @type {Readonly<Record<string, string>>}
 */
const UNSUPPORTED_MEDIA_TYPE_ISSUE: Readonly<Record<string, string>> = Object.freeze({
  in: 'body',
  path: '',
  code: 'unsupported_media_type',
  message: 'Expected an application/json body in UTF-8.',
});

/**
 * Function isJsonInUtf8
 *
 * @description
 * Tells whether a `Content-Type` names JSON in UTF-8: its essence (the part before the first
 * `;`, trimmed) is `application/json`, case-insensitive, and its `charset` parameter, when there
 * is one, is `utf-8`, case-insensitive and quotes removed (RFC 8259 §8.1). Other parameters are
 * ignored. The parse is deliberately minimal: neither `type-is` nor `content-type` is a direct
 * dependency of the gateway, and a value it reads wrongly (a quoted `;`) can only be refused.
 *
 * @param {string} contentType - The `Content-Type` of the request.
 * @returns {boolean} `true` for JSON in UTF-8 only.
 */
function isJsonInUtf8(contentType: string): boolean {
  const [essence = '', ...parameters] = contentType.split(';');
  if (essence.trim().toLowerCase() !== 'application/json') {
    return false;
  }
  return parameters.every((parameter: string) => {
    const separator: number = parameter.indexOf('=');
    const name: string = (separator === -1 ? parameter : parameter.slice(0, separator))
      .trim()
      .toLowerCase();
    if (name !== 'charset') {
      return true;
    }
    const value: string = parameter
      .slice(separator + 1)
      .trim()
      .replace(/^"(.*)"$/u, '$1')
      .toLowerCase();
    return separator !== -1 && value === 'utf-8';
  });
}

/**
 * Function invalidBody
 *
 * @description
 * Builds the problem of a required body refused before its validator.
 *
 * @param {Readonly<Record<string, string>>} issue - The single issue, about the body itself.
 * @returns {ProblemException} 400 `request.invalid`.
 */
function invalidBody(issue: Readonly<Record<string, string>>): ProblemException {
  return new ProblemException({
    status: 400,
    code: 'request.invalid',
    detail: 'The request does not match its contract.',
    details: { issues: [issue] },
  });
}

/**
 * Function toRequiredBody
 *
 * @description
 * Validates the body of an operation whose contract marks `requestBody.required: true` with
 * `application/json` as its only media type. In order:
 *
 * - a request that declares `Content-Length: 0` is refused (`code: required`): the JSON parser of
 *   `@cadenway/nest-common` hands a zero-byte JSON body on as `{}`, which an `EmptyRequest`
 *   would accept;
 * - a request whose `Content-Type` is not JSON in UTF-8 is refused
 *   (`code: unsupported_media_type`): the form parser NestJS registers turns a body such as `&`
 *   into `{}` too, and a body in another charset may decode to nothing (a UTF-16 byte-order
 *   mark alone);
 * - any other body, a literal `{}` included, goes through `ZodValidationPipe` exactly as
 *   `@Body(new ZodValidationPipe(contract))` takes it. A request without `Content-Type` is left
 *   to it: no parser reads its body, which stays `undefined` and is refused as `invalid_type`.
 *
 * Limitation: a JSON body whose decoded text is empty also reaches the gateway as `{}`, with
 * nothing left to tell it from a literal `{}`: an empty chunked body (`Transfer-Encoding:
 * chunked` with no data), an empty body under a `Content-Encoding`, or a UTF-8 byte-order mark
 * alone. It belongs to the parser of cadenway-service-kit, which should leave such a body
 * `undefined`.
 *
 * @param {JsonRequest} request - The HTTP request, after the body parsers.
 * @param {z.ZodType} contract - Validator of the body in the public contract.
 * @returns {unknown} The body as the validator parsed it.
 * @throws {ProblemException} 400 `request.invalid` with one `details.issues` entry for the body
 *   itself when the request declares a zero-byte body or another media type, or the problem of
 *   `ZodValidationPipe` when the body does not satisfy the contract.
 */
export function toRequiredBody(request: JsonRequest, contract: z.ZodType): unknown {
  if (Number(request.headers['content-length']) === 0) {
    throw invalidBody(MISSING_BODY_ISSUE);
  }
  const contentType: string | undefined = request.headers['content-type'];
  if (contentType !== undefined && !isJsonInUtf8(contentType)) {
    throw invalidBody(UNSUPPORTED_MEDIA_TYPE_ISSUE);
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

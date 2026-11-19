import { ProblemException } from '@cadenway/nest-common';
import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';

/**
 * Constant NOT_BLANK
 *
 * @description
 * Matches a header value holding at least one character that is not HTTP optional whitespace
 * (a space or a horizontal tab).
 *
 * @type {RegExp}
 */
const NOT_BLANK: RegExp = /[^\t ]/u;

/**
 * Constant IF_MATCH
 *
 * @description
 * Validator of `If-Match` on every versioned write: optional, as every public contract declares
 * it, but never blank. The value is otherwise left as it is, quotes and weak prefix included, for
 * the owning service to compare. The contracts declare no dedicated code for it, hence the
 * `request.invalid` of any request outside its contract.
 *
 * @type {z.ZodOptional<z.ZodString>}
 */
const IF_MATCH: z.ZodOptional<z.ZodString> = z
  .string()
  .regex(NOT_BLANK, { message: 'Expected an entity tag, not a blank value.' })
  .optional();

/**
 * Function toRequestHeader
 *
 * @description
 * Validates a request header against the validator of its public operation (an
 * `Idempotency-Key` of 1 to 255 characters, for example): the route decorators of NestJS read a
 * header without a pipe. An invalid value answers what `ZodValidationPipe` answers for the other
 * parts of a request, with the issue located in the header.
 *
 * @param {string} name - Name of the header, as the contract writes it.
 * @param {TSchema} schema - Validator of the header in the public contract.
 * @param {unknown} value - The header as Express read it, `undefined` when absent.
 * @returns {z.output<TSchema>} The validated value.
 * @throws {ProblemException} 400 `request.invalid` when the value does not satisfy the schema.
 */
export function toRequestHeader<TSchema extends z.ZodType>(
  name: string,
  schema: TSchema,
  value: unknown,
): z.output<TSchema> {
  const parsed: z.ZodSafeParseResult<z.output<TSchema>> = schema.safeParse(value);
  if (!parsed.success) {
    throw new ProblemException({
      status: 400,
      code: 'request.invalid',
      detail: 'The request does not match its contract.',
      details: {
        issues: parsed.error.issues.map((issue: z.core.$ZodIssue) => ({
          in: 'header',
          path: name,
          code: issue.code,
          message: issue.message,
        })),
      },
    });
  }
  return parsed.data;
}

/**
 * Function toIfMatchHeader
 *
 * @description
 * Reads the `If-Match` of a versioned write before it is relayed. An absent header stays absent:
 * the write is then unconditional, as every contract allows. A present but blank one (empty, or
 * spaces and tabs only) is refused: the owning service would take it for an absent one and turn
 * a conditional write into an unconditional one. Any other value is returned unchanged, with no
 * further format check: comparing it with the current version is the owning service's decision.
 *
 * Node.js strips the optional whitespace around a header value, so `If-Match: \t ` on the wire
 * reaches the gateway as `""`; the check covers both forms.
 *
 * @param {unknown} value - `If-Match` as Express read it, `undefined` when absent.
 * @returns {string | undefined} The value to relay, `undefined` when absent.
 * @throws {ProblemException} 400 `request.invalid`, with one `details.issues` entry
 *   `{ in: 'header', path: 'If-Match' }`, when the header is present but blank.
 */
export function toIfMatchHeader(value: unknown): string | undefined {
  return toRequestHeader('If-Match', IF_MATCH, value);
}

/**
 * Constant IfMatchHeader
 *
 * @description
 * Route parameter decorator of `If-Match`, for every route that relays it, in place of
 * `@Headers('if-match')`: `@IfMatchHeader() ifMatch: string | undefined`. It reads the header
 * through `toIfMatchHeader`, so a blank value answers 400 `request.invalid` after the guards and
 * before the handler, hence before any upstream call.
 *
 * @type {() => ParameterDecorator}
 */
export const IfMatchHeader: () => ParameterDecorator = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string | undefined =>
    toIfMatchHeader(context.switchToHttp().getRequest<Request>().headers['if-match']),
);

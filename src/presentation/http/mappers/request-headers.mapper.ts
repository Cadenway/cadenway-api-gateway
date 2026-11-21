import { ProblemException } from '@cadenway/nest-common';
import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';

/**
 * Function hasListMember
 *
 * @description
 * Tells whether a header value holds at least one member of its comma-separated list once each
 * member is trimmed with JavaScript `trim()`, the way the `parseIfMatch` of
 * `@cadenway/nest-common` reads it on the owning service. `trim()` strips every Unicode white
 * space (a no-break space U+00A0 included) and line terminator, so a value such as `" "` (U+00A0),
 * `","`, `", "` or `" , "` has none.
 *
 * @param {string} value - The header value.
 * @returns {boolean} `false` when no member is left.
 */
function hasListMember(value: string): boolean {
  return value.split(',').some((member: string) => member.trim() !== '');
}

/**
 * Constant IF_MATCH
 *
 * @description
 * Validator of `If-Match` on every versioned write: optional, as every public contract declares
 * it, but never blank. The value is otherwise left as it is, quotes, weak prefix and `*`
 * included, for the owning service to compare. The contracts declare no dedicated code for it,
 * hence the `request.invalid` of any request outside its contract.
 *
 * @type {z.ZodOptional<z.ZodString>}
 */
const IF_MATCH: z.ZodOptional<z.ZodString> = z
  .string()
  .refine(hasListMember, { message: 'Expected an entity tag, not a blank value.' })
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
 * @param {{ readonly singleIssue: boolean } | undefined} options - Emit only the first failure when the contract requires one issue per header.
 * @returns {z.output<TSchema>} The validated value.
 * @throws {ProblemException} 400 `request.invalid` when the value does not satisfy the schema.
 */
export function toRequestHeader<TSchema extends z.ZodType>(
  name: string,
  schema: TSchema,
  value: unknown,
  options?: { readonly singleIssue: boolean },
): z.output<TSchema> {
  const parsed: z.ZodSafeParseResult<z.output<TSchema>> = schema.safeParse(value);
  if (!parsed.success) {
    const issues =
      options?.singleIssue === true ? parsed.error.issues.slice(0, 1) : parsed.error.issues;
    throw new ProblemException({
      status: 400,
      code: 'request.invalid',
      detail: 'The request does not match its contract.',
      details: {
        issues: issues.map((issue: z.core.$ZodIssue) => ({
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
 * the write is then unconditional, as every contract allows. A present but blank one is refused:
 * the owning service would take it for an absent one and turn a conditional write into an
 * unconditional one. Blank means that no member of its comma-separated list is left after
 * JavaScript `trim()`: an empty value, white space only (a no-break space included), or commas
 * and white space only, such as the `", "` Node.js makes of two empty `If-Match` headers. Any
 * other value is returned unchanged (`"4"`, `W/"7"`, `*`, `"4", "5"`), with no further format
 * check: comparing it with the current version is the owning service's decision.
 *
 * Node.js strips the spaces and tabs around a header value, so `If-Match: \t ` on the wire
 * reaches the gateway as `""`; a no-break space is kept and refused here.
 *
 * @param {unknown} value - `If-Match` as Express read it, `undefined` when absent.
 * @returns {string | undefined} The value to relay, `undefined` when absent.
 * @throws {ProblemException} 400 `request.invalid`, with one `details.issues` entry
 *   `{ in: 'header', path: 'If-Match', code: 'custom' }`, when the header is present but blank.
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

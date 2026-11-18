import { ProblemException } from '@cadenway/nest-common';
import type { z } from 'zod';

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

import { SearchQueryParams } from '@cadenway/contracts/validators/public/search';
import { z } from 'zod';

/** Rejects repeated or unknown keys before the generated limit coercion. */
export const searchQueryValidation = SearchQueryParams.strict().extend({
  cursor: z.string().min(1).max(1024).optional(),
  limit: z
    .string()
    .regex(/^\d+$/u)
    .transform(Number)
    .pipe(z.number().int().min(1).max(100))
    .default(50),
});

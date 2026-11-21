import { ProblemException } from '@cadenway/nest-common';
import type { PipeTransform } from '@nestjs/common';
import type { z } from 'zod';

import { searchQueryValidation } from './search-query.validation.js';

/** Validates search parameters without including user-supplied values or keys in a problem. */
export class SearchQueryPipe implements PipeTransform<
  unknown,
  z.output<typeof searchQueryValidation>
> {
  // #region Methods
  /** Parses a strict query or rejects it with a fixed public issue. */
  public transform(value: unknown): z.output<typeof searchQueryValidation> {
    const parsed = searchQueryValidation.safeParse(value);
    if (!parsed.success) {
      throw new ProblemException({
        status: 400,
        code: 'request.invalid',
        title: 'Paramètres de recherche invalides.',
        details: {
          issues: [
            { in: 'query', path: '', code: 'invalid_query', message: 'Invalid search query.' },
          ],
        },
      });
    }
    return parsed.data;
  }
  // #endregion
}

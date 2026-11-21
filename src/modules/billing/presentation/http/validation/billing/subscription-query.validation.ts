import { ProblemException } from '@cadenway/nest-common';
import type { PipeTransform } from '@nestjs/common';
import { z } from 'zod';

const querySchema = z.strictObject({});

/** Rejects unknown query keys without echoing them into public problems. */
export class SubscriptionQueryPipe implements PipeTransform<unknown, object> {
  // #region Methods
  /** Parses the empty query required by the subscription operation. */
  public transform(value: unknown): object {
    const query = querySchema.safeParse(value);
    if (!query.success) {
      throw new ProblemException({
        status: 400,
        code: 'request.invalid',
        details: {
          issues: [{ in: 'query', path: '', code: 'unrecognized_keys', message: 'Invalid query.' }],
        },
      });
    }
    return query.data;
  }
  // #endregion
}

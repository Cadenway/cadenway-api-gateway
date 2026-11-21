import { ProblemException } from '@cadenway/nest-common';

import { isProblemStatus } from '../../../../../../problems/public-problem.js';
import {
  toPublicProblem,
  type AcceptedProblems,
} from '../../../../../../problems/upstream-problem.js';

const commonErrors: AcceptedProblems = {
  400: ['request.invalid', 'request.body-too-large'],
  503: [
    'upstream.unavailable',
    'upstream.unreachable',
    'upstream.timeout',
    'upstream.circuit-open',
    'upstream.failed',
    'upstream.unauthorized',
    'upstream.deadline-exceeded',
  ],
};

const contactErrors: AcceptedProblems = {
  ...commonErrors,
  409: ['idempotency.request-in-progress'],
  422: ['idempotency.key-reused'],
};

/** Relays the operation and reconstructs declared errors without upstream personal data. */
export async function relaySiteSubmission(
  operation: 'contact' | 'newsletter',
  submit: () => Promise<void>,
): Promise<void> {
  try {
    await submit();
  } catch (error) {
    const accepted = operation === 'contact' ? contactErrors : commonErrors;
    const translated = toPublicProblem(error, accepted);
    if (translated instanceof ProblemException) {
      const { status, code } = translated.problem;
      if (isProblemStatus(status) && accepted[status]?.includes(code) === true) {
        throw new ProblemException({ status, code });
      }
    }
    throw new ProblemException({ status: 503, code: 'upstream.failed' });
  }
}

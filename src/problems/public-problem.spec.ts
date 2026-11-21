import { ProblemException, type Problem } from '@cadenway/nest-common';
import { describe, expect, it } from 'vitest';

import { problemExamples } from '../../tests/support/public-contract.js';
import {
  PROBLEM_TITLES,
  isProblemStatus,
  publicProblem,
  siteFormProblem,
} from './public-problem.js';

/**
 * Function reasonPhrase
 *
 * @description
 * The English reason phrase `ProblemException` gives a status when no title is set.
 *
 * @param {number} status - HTTP status of a problem.
 * @returns {string} The phrase.
 */
function reasonPhrase(status: number): string {
  return new ProblemException({ status: status as 400, code: 'test.phrase' }).problem.title;
}

describe('PROBLEM_TITLES', () => {
  const examples: readonly { pointer: string; value: Readonly<Record<string, unknown>> }[] =
    problemExamples();

  it('reads problem examples from every shipped public contract', () => {
    expect(examples.length).toBeGreaterThan(40);
    for (const spec of ['auth.yaml', 'organizations.yaml', 'members.yaml', 'api-tokens.yaml']) {
      expect(examples.some((example) => example.pointer.startsWith(`${spec}#`))).toBe(true);
    }
  });

  it.each(examples.map((example) => [example.pointer, example.value] as const))(
    'gives %s the title of the contract',
    (pointer, example) => {
      const standard = publicProblem({
        status: example.status as 400,
        code: String(example.code),
      });
      const error = pointer.startsWith('site.yaml#') ? siteFormProblem(standard) : standard;
      if (!(error instanceof ProblemException)) throw new Error('The example is not a problem.');
      const problem: Problem = error.problem;

      expect(problem.title).toBe(example.title);
      expect(standard.problem.title).toBe(
        PROBLEM_TITLES.get(String(example.code)) ?? reasonPhrase(Number(example.status)),
      );
    },
  );

  it('holds only codes the public contract shows with a French title', () => {
    const shown: string[] = examples.map((example) => String(example.value.code));

    for (const code of PROBLEM_TITLES.keys()) {
      expect(shown).toContain(code);
    }
  });
});

describe('publicProblem', () => {
  it('replaces the title a thrower gives with the one of the code', () => {
    const problem: Problem = publicProblem({
      status: 409,
      code: 'auth.email-taken',
      title: 'Conflict',
    }).problem;

    expect(problem.title).toBe('Un compte existe déjà avec cette adresse.');
  });

  it('keeps the reason phrase of the status for a code the web application does not show', () => {
    expect(publicProblem({ status: 403, code: 'auth.csrf-rejected' }).problem.title).toBe(
      'Forbidden',
    );
  });
});

describe('isProblemStatus', () => {
  it.each([400, 401, 403, 404, 409, 412, 422, 429, 503])('accepts %i', (status) => {
    expect(isProblemStatus(status)).toBe(true);
  });

  it.each([200, 302, 418, 500, 502])('refuses %i', (status) => {
    expect(isProblemStatus(status)).toBe(false);
  });
});

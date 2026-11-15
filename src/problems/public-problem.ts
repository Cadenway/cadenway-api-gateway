import { ProblemException, type ProblemInit, type ProblemStatus } from '@cadenway/nest-common';

/**
 * Constant PROBLEM_TITLES
 *
 * @description
 * French `title` of the public problems the web application shows to the person as they are,
 * by `code`, taken from the examples of `openapi/public/auth.yaml` of `@cadenway/contracts`
 * (the French titles decision of docs/integration.md: the gateway owns this mapping). Every
 * other code keeps the English reason phrase of its status, which `ProblemException` fills in.
 * The text is the same
 * for every occurrence of a code; the punctuation (the space before a colon, the typographic
 * apostrophe) is the contract's, character for character.
 *
 * @type {ReadonlyMap<string, string>}
 */
export const PROBLEM_TITLES: ReadonlyMap<string, string> = new Map<string, string>([
  ['auth.email-taken', 'Un compte existe déjà avec cette adresse.'],
  ['auth.terms-not-accepted', 'Acceptez les conditions pour créer votre compte.'],
  ['auth.password-too-short', 'Le mot de passe doit compter 12 caractères minimum.'],
  [
    'auth.password-compromised',
    'Ce mot de passe figure parmi des mots de passe divulgués : choisissez-en un autre.',
  ],
  ['auth.code-invalid', 'Code incorrect ou expiré : vérifiez le dernier e-mail reçu.'],
  ['auth.code-expired', 'Code incorrect ou expiré : vérifiez le dernier e-mail reçu.'],
  ['auth.invalid-credentials', 'E-mail ou mot de passe incorrect.'],
  ['auth.email-not-verified', 'Confirmez votre adresse e-mail pour vous connecter.'],
  ['auth.account-locked', 'Trop de tentatives échouées.'],
  [
    'auth.code-throttled',
    'Un code vient d’être envoyé : patientez avant d’en demander un nouveau.',
  ],
  ['auth.session-required', 'Connectez-vous pour continuer.'],
  ['auth.session-expired', 'Session expirée'],
]);

/**
 * Constant PROBLEM_STATUSES
 *
 * @description
 * Statuses a problem of the Cadenway contracts may carry, as `ProblemStatus` of
 * `@cadenway/nest-common` lists them.
 *
 * @type {ReadonlySet<number>}
 */
const PROBLEM_STATUSES: ReadonlySet<number> = new Set<number>([
  400, 401, 403, 404, 409, 412, 422, 429, 503,
]);

/**
 * Function isProblemStatus
 *
 * @description
 * Narrows an HTTP status to one a problem of the contracts may carry.
 *
 * @param {number} status - HTTP status.
 * @returns {boolean} `true` for 400, 401, 403, 404, 409, 412, 422, 429 and 503.
 */
export function isProblemStatus(status: number): status is ProblemStatus {
  return PROBLEM_STATUSES.has(status);
}

/**
 * Function publicProblem
 *
 * @description
 * Builds the problem the gateway answers to the applications: the French title of
 * `PROBLEM_TITLES` when the code has one, the reason phrase of the status otherwise. A `title`
 * given in `init` is ignored: the title belongs to the code, never to the thrower, so an internal
 * title never reaches the applications.
 *
 * @param {ProblemInit} init - Status, code and optional members of the problem.
 * @returns {ProblemException} The problem to throw.
 */
export function publicProblem(init: ProblemInit): ProblemException {
  // An undefined title makes `ProblemException` fall back to the reason phrase of the status.
  return new ProblemException({ ...init, title: PROBLEM_TITLES.get(init.code) });
}

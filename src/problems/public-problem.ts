import { ProblemException, type ProblemInit, type ProblemStatus } from '@cadenway/nest-common';

/**
 * Constant PROBLEM_TITLES
 *
 * @description
 * French `title` of the public problems the web application shows to the person as they are,
 * by `code`, taken from the examples of `openapi/public/` (`auth.yaml`, `organizations.yaml`,
 * `members.yaml`, `api-tokens.yaml`) of `@cadenway/contracts`, the account security codes of
 * 0.7.0 and the two-step verification codes of 0.8.0 included
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
  [
    'auth.sign-up-replaced',
    'Une autre inscription a été faite avec cette adresse : recommencez votre inscription.',
  ],
  ['auth.invalid-credentials', 'E-mail ou mot de passe incorrect.'],
  ['auth.email-not-verified', 'Confirmez votre adresse e-mail pour vous connecter.'],
  ['auth.account-locked', 'Trop de tentatives échouées.'],
  [
    'auth.code-throttled',
    'Un code vient d’être envoyé : patientez avant d’en demander un nouveau.',
  ],
  ['auth.session-required', 'Connectez-vous pour continuer.'],
  ['auth.session-expired', 'Session expirée'],
  ['auth.api-token-invalid', 'Jeton d’API invalide, expiré ou révoqué.'],
  ['auth.api-token-not-accepted', 'Cette requête n’accepte pas de jeton d’API.'],
  ['auth.scope-missing', 'Ce jeton n’a pas la portée nécessaire pour cette requête.'],
  [
    'request.version-mismatch',
    'Ces informations ont été modifiées entre-temps : rechargez la page.',
  ],
  ['rate-limit.exceeded', 'Trop de requêtes : réessayez dans un instant.'],
  ['organization.not-selected', 'Choisissez une organisation pour continuer.'],
  ['organization.role-forbidden', 'Votre rôle ne permet pas cette action.'],
  ['organization.not-found', 'Organisation introuvable.'],
  ['organization.slug-taken', 'Cette adresse est déjà utilisée par une autre organisation.'],
  ['organization.slug-invalid', 'L’adresse doit compter au moins 2 caractères.'],
  [
    'user.not-synchronized',
    'Votre compte est en cours de préparation : réessayez dans un instant.',
  ],
  ['member.not-found', 'Membre introuvable.'],
  [
    'member.owner-protected',
    'Le propriétaire de l’organisation ne peut être ni retiré ni changé de rôle.',
  ],
  ['invitation.not-found', 'Invitation introuvable.'],
  ['invitation.email-mismatch', 'Cette invitation a été envoyée à une autre adresse e-mail.'],
  ['invitation.revoked', 'Cette invitation a été annulée.'],
  ['invitation.answered', 'Vous avez déjà répondu à cette invitation.'],
  [
    'invitation.expired',
    'Cette invitation a expiré : demandez-en une nouvelle à un administrateur de l’organisation.',
  ],
  [
    'invitation.resend-throttled',
    'Cette invitation vient d’être renvoyée : réessayez dans une heure.',
  ],
  [
    'invitation.daily-limit-reached',
    'Limite d’invitations atteinte pour aujourd’hui : réessayez plus tard.',
  ],
  ['api-token.not-found', 'Jeton introuvable.'],
  [
    'auth.reset-throttled',
    'Un lien vient d’être envoyé : patientez avant d’en demander un nouveau.',
  ],
  ['auth.reset-link-expired', 'Ce lien a expiré'],
  ['auth.password-incorrect', 'Mot de passe incorrect.'],
  ['auth.reauthentication-required', 'Confirmez votre identité pour continuer.'],
  ['auth.email-unchanged', 'C’est déjà votre adresse actuelle : saisissez la nouvelle.'],
  [
    'account.organization-owner',
    'Chaque organisation dont vous êtes propriétaire doit d’abord avoir un autre propriétaire.',
  ],
  ['session.not-found', 'Session introuvable.'],
  ['auth.challenge-expired', 'La vérification a expiré : connectez-vous de nouveau.'],
  ['auth.two-step-code-invalid', 'Code incorrect ou déjà utilisé.'],
  [
    'auth.security-key-refused',
    'Clé de sécurité non reconnue : réessayez ou choisissez une autre méthode.',
  ],
  ['auth.two-step-locked', 'Trop de tentatives échouées : réessayez dans 15 minutes.'],
  ['auth.two-step-not-enabled', 'Activez d’abord la vérification en deux étapes.'],
  ['auth.two-step-setup-expired', 'La configuration a expiré : recommencez.'],
  [
    'auth.security-key-limit-reached',
    'Nombre maximal de clés de sécurité atteint : retirez-en une pour en ajouter une autre.',
  ],
  [
    'auth.mfa-required-by-organization',
    'Une de vos organisations exige la vérification en deux étapes : elle ne peut pas être désactivée.',
  ],
  [
    'organization.mfa-required',
    'Cette organisation exige la vérification en deux étapes : configurez-la depuis votre compte.',
  ],
  ['security-key.not-found', 'Clé de sécurité introuvable.'],
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

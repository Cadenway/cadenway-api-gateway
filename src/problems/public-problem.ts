import { ProblemException, type ProblemInit, type ProblemStatus } from '@cadenway/nest-common';

/**
 * Constant PROBLEM_TITLES
 *
 * @description
 * French `title` of the public problems the web application shows to the person as they are,
 * by `code`, taken from the examples of `openapi/public/` (`auth.yaml`, `organizations.yaml`,
 * `members.yaml`, `api-tokens.yaml`, `spaces.yaml`, `lists.yaml`, `tasks.yaml`, `access.yaml`,
 * `archives.yaml`, `trash.yaml`) of `@cadenway/contracts`, the account security codes of 0.7.0,
 * the two-step verification codes of 0.8.0, the task core codes of 0.9.0 and the access, archive
 * and trash codes of 0.10.0 included (the French titles decision of docs/integration.md: the gateway owns this mapping). Every
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
  ['space.not-found', 'Espace introuvable.'],
  ['space.prefix-taken', 'Ce préfixe est déjà utilisé par un autre espace.'],
  [
    'space.visibility-forbidden',
    'Seuls le propriétaire de l’espace et les administrateurs changent sa confidentialité.',
  ],
  ['space.status-required', 'Ce statut est obligatoire : il ne peut pas être masqué.'],
  ['list.not-found', 'Liste introuvable.'],
  ['list.sprint-dates-invalid', 'La fin doit suivre le début.'],
  ['task.not-found', 'Tâche introuvable.'],
  ['task.status-hidden', 'Ce statut n’est plus utilisé dans cet espace.'],
  [
    'task.cancel-reason-required',
    'Indiquez pourquoi : le motif reste visible sur la tâche et dans les rapports.',
  ],
  ['task.assignee-invalid', 'Seuls les membres de l’organisation peuvent être assignés.'],
  ['task.assignee-limit-reached', '20 personnes au plus par tâche.'],
  ['task.start-date-invalid', 'Le début doit précéder l’échéance.'],
  ['task.list-invalid', 'Cette liste n’existe pas ou ne vous est pas accessible.'],
  [
    'task.parent-invalid',
    'Une tâche ne peut pas devenir sous-tâche d’elle-même ni de ses sous-tâches.',
  ],
  [
    'task.subtask-depth-exceeded',
    'Niveau maximal atteint : 3 niveaux (tâche, sous-tâche, sous-sous-tâche). Utilisez la checklist pour détailler davantage.',
  ],
  ['task.subtask-limit-reached', '25 sous-tâches au plus : découpez plutôt en plusieurs tâches.'],
  ['task.label-limit-reached', '20 étiquettes au plus par tâche.'],
  ['task.checklist-limit-reached', '100 éléments au plus par checklist.'],
  ['checklist-item.not-found', 'Élément de checklist introuvable.'],
  ['access.role-insufficient', 'Il faut le droit « Peut modifier » pour cette action.'],
  [
    'space.manage-forbidden',
    'Seuls le propriétaire de l’espace et les administrateurs le partagent et le suppriment.',
  ],
  [
    'access.grantee-invalid',
    'Cette personne ne fait pas partie de l’organisation : invitez-la d’abord.',
  ],
  ['access.guest-space-forbidden', 'Les invités n’ont accès qu’à des listes précises.'],
  ['access.owner-unchangeable', 'L’accès du propriétaire de l’espace ne se modifie pas.'],
  ['access.grant-limit-reached', '200 personnes au plus par espace ou par liste.'],
  ['access-request.not-found', 'Demande d’accès introuvable.'],
  ['access-request.already-decided', 'Cette demande d’accès a déjà reçu une réponse.'],
  ['access-request.limit-reached', 'Trop de demandes d’accès : réessayez plus tard.'],
  [
    'task.archived',
    'Cette tâche est archivée : restaurez-la depuis les Archives pour la modifier.',
  ],
  ['task.trashed', 'Cette tâche a été supprimée'],
  ['template.not-found', 'Modèle introuvable.'],
  ['template.source-restricted', 'Ce modèle ne peut pas être partagé dans cet espace.'],
  ['template.limit-reached', 'La limite de modèles est atteinte.'],
  ['favorite.target-not-found', 'Cet élément est introuvable.'],
  ['favorite.not-found', 'Favori introuvable.'],
  ['favorite.already-exists', 'Cet élément est déjà dans vos favoris.'],
  ['favorite.limit-reached', 'La limite de favoris est atteinte.'],
  ['saved-view.not-found', 'Vue introuvable.'],
  ['saved-view.list-archived', 'Cette liste est archivée.'],
  ['saved-view.limit-reached', 'La limite de vues est atteinte.'],
  ['mention.recipient-invalid', 'Le destinataire de la mention est indisponible.'],
  ['milestone.status-invalid', 'Ce statut ne convient pas au jalon.'],
  ['milestone.dates-invalid', 'Les dates du jalon sont invalides.'],
  ['recurrence.date-out-of-range', 'La date de la prochaine occurrence est invalide.'],
  ['recurrence.already-spawned', 'Cette récurrence a déjà créé une occurrence.'],
  ['trash-entry.not-restorable-yet', 'Cet élément ne peut pas encore être restauré.'],
  ['list.duplicate-limit-reached', 'Cette liste contient trop de tâches à dupliquer.'],
  ['bulk.expansion-limit-reached', 'La limite de tâches est atteinte.'],
  ['dependency.not-found', 'Dépendance introuvable.'],
  ['dependency.already-exists', 'Cette dépendance existe déjà.'],
  ['dependency.cycle', 'Cette dépendance créerait un cycle.'],
  ['dependency.limit-reached', 'La limite de dépendances est atteinte.'],
  ['comment.author-required', 'Seul l’auteur peut modifier ce commentaire.'],
  ['comment.not-found', 'Commentaire introuvable.'],
  ['time-entry.author-required', 'Seul l’auteur peut supprimer cette saisie'],
  ['time-entry.not-found', 'Saisie de temps introuvable'],
  ['custom-field.not-found', 'Champ personnalisé introuvable.'],
  ['custom-field.limit-reached', 'Un espace peut contenir 30 champs personnalisés actifs.'],
  ['custom-field.position-invalid', 'Position du champ personnalisé invalide.'],
  ['custom-field.sprint-points-invalid', 'Le champ ne peut pas servir aux points de sprint.'],
  ['custom-field.value-invalid', 'Valeur de champ personnalisé invalide.'],
  [
    'approval.reviewer-required',
    'Vous ne faites pas partie des personnes chargées de l’approbation.',
  ],
  ['approval.round-not-found', 'Cette demande d’approbation est introuvable.'],
  ['approval.milestone-unsupported', 'Un jalon ne peut pas être soumis à approbation.'],
  ['approval.vote-already-recorded', 'Retirez votre vote avant d’en soumettre un autre.'],
  ['approval.reviewer-invalid', 'Une personne choisie ne peut pas modifier cette tâche.'],
  ['onboarding.wizard-closed', 'Assistant déjà fermé.'],
  ['onboarding.checklist-unavailable', 'Liste de démarrage indisponible.'],
  ['watcher.recipient-invalid', 'Ce destinataire est indisponible.'],
  ['watcher.limit-reached', 'La limite des abonnements est atteinte.'],
  ['trash-entry.not-found', 'Cet élément n’est plus dans la corbeille.'],
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

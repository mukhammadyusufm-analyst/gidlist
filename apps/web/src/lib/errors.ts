/**
 * Turning refusals into sentences — in the language the person is reading.
 *
 * =============================================================================
 * WHY THIS FILE CHANGED SHAPE
 *
 * It used to return English sentences. So did four other `friendly()` helpers
 * scattered across the actions, and so did 153 hard-coded messages besides. A
 * person using the product in Uzbek or Russian was answered in English at
 * exactly the moment something had gone wrong — which is the moment they most
 * need to understand the words.
 *
 * Every helper here now takes the caller's `t`, from `getTranslations()`, and
 * returns text in their language. The rules that recognise a refusal live in
 * one list instead of five, so the same refusal reads the same way wherever it
 * surfaces.
 *
 * =============================================================================
 * WHY MATCHING ON THE DATABASE'S ENGLISH IS ACCEPTABLE
 *
 * The triggers and functions raise deliberately matchable text, and it is text
 * this repository wrote — it changes only in a migration, alongside this file.
 * Numbers inside a message (metres away, a time window, a plan's limit) are
 * pulled out and put back into the translated sentence rather than lost.
 *
 * Anything not recognised is returned as it came, never replaced by a vague
 * "something went wrong". An untranslated refusal still says what happened; a
 * translated non-answer says nothing, and sends somebody off to fix the wrong
 * thing.
 *
 * A plain module rather than living beside the actions: files marked
 * `'use server'` may only export async functions, so a shared helper cannot sit
 * in one.
 */

type Translate = (key: string, values?: Record<string, string | number>) => string;

type Rule = {
  match: RegExp;
  key: string;
  values?: (m: RegExpMatchArray) => Record<string, string | number>;
};

/*
 * ORDER MATTERS. The first rule that matches wins, so specific refusals come
 * before the general ones they would otherwise be swallowed by — "you do not
 * have permission to change account limits" must reach its own sentence before
 * the catch-all permission rule sees it.
 */
const DATABASE_RULES: Rule[] = [
  // Plans and rate limits
  { match: /Space limit reached/i, key: 'errors.spaceLimit' },
  { match: /Member limit reached/i, key: 'errors.memberLimit' },
  { match: /Rate limit reached/i, key: 'errors.rateLimit' },

  // Members and reporting lines
  { match: /loop in the reporting lines/i, key: 'errors.reportingLoop' },
  { match: /nested too deeply/i, key: 'errors.reportingTooDeep' },
  { match: /member of the same space/i, key: 'errors.managerSameSpace' },
  { match: /cannot report to themselves/i, key: 'errors.reportToSelf' },
  { match: /owner cannot be removed/i, key: 'errors.ownerCannotBeRemoved' },
  { match: /transfer ownership|transferred to an active member/i, key: 'errors.ownershipTransfer' },
  { match: /space has checklist history/i, key: 'errors.spaceHasHistory' },
  { match: /practice space can be removed once/i, key: 'errors.practiceNotYet' },
  { match: /practice space cannot hold new checklists/i, key: 'errors.practiceNoNewChecklists' },
  { match: /practice checklist cannot be changed/i, key: 'errors.practiceReadOnly' },
  { match: /practice checklist cannot be scheduled/i, key: 'errors.practiceNoSchedules' },
  { match: /practice space cannot take new members/i, key: 'errors.practiceNoMembers' },
  { match: /newer version of this checklist was published/i, key: 'errors.submissionOutdated' },

  // Building checklists
  { match: /checklist has been filled in/i, key: 'errors.checklistHasHistory' },
  { match: /levels deep/i, key: 'errors.nestingLimit' },
  {
    match: /published and can no longer be changed|published version cannot be altered/i,
    key: 'errors.versionPublished',
  },
  { match: /at least one item before publishing/i, key: 'errors.publishNeedsItem' },
  { match: /schedule before publishing/i, key: 'errors.publishNeedsSchedule' },
  { match: /version is not a draft/i, key: 'errors.versionNotDraft' },
  { match: /Parent item does not exist|different version/i, key: 'errors.itemParentInvalid' },

  // Filling in
  { match: /completes automatically/i, key: 'errors.parentAutoCompletes' },
  { match: /assigned to someone else/i, key: 'errors.assignedToSomeoneElse' },
  { match: /no published version/i, key: 'errors.noPublishedVersion' },
  { match: /already been completed/i, key: 'errors.alreadySubmitted' },
  { match: /cannot be completed from its current state/i, key: 'errors.cannotSubmitState' },
  { match: /submission does not exist/i, key: 'errors.submissionMissing' },
  { match: /Take the photo for this item/i, key: 'errors.photoRequiredToTick' },
  { match: /Attach the photo or file for this item/i, key: 'errors.evidenceRequiredToTick' },
  { match: /Attach the file for this item/i, key: 'errors.fileRequiredToTick' },
  {
    match: /about (\d+) metres away.*within (\d+) metres/i,
    key: 'errors.tooFarAway',
    values: (m) => ({ distance: m[1], radius: m[2] }),
  },
  { match: /ticked at its location/i, key: 'errors.locationRequiredToTick' },
  {
    match: /only be ticked between (\S+) and (\S+)\. It is now (\S+?)\.?$/i,
    key: 'errors.outsideWindow',
    // The database formats times with seconds; nobody reads a ticking window
    // to the second.
    values: (m) => ({ from: m[1].slice(0, 5), to: m[2].slice(0, 5), now: m[3].slice(0, 5) }),
  },
  { match: /not yours to (accept|decline)/i, key: 'errors.invitationUnavailable' },

  // Schedules
  { match: /before assigning them a schedule/i, key: 'errors.notInSpaceYet' },
  { match: /must keep at least one|must name at least one/i, key: 'errors.scheduleNeedsPerson' },
  { match: /Choose at least one person, or assign this to everyone/i, key: 'errors.choosePerson' },
  { match: /schedule does not exist/i, key: 'errors.scheduleMissing' },

  // Voiding
  { match: /Voiding a record needs|Only a space admin can void/i, key: 'errors.voidNotAllowed' },
  { match: /reason of at least three characters/i, key: 'errors.voidReasonShort' },
  { match: /No such record/i, key: 'errors.recordMissing' },

  // Administration
  { match: /change account limits/i, key: 'errors.needsBillingCapability' },
  { match: /only be granted directly in the database/i, key: 'errors.rootCapabilitySqlOnly' },
  { match: /cannot delete the account you are signed in with/i, key: 'errors.cannotDeleteSelf' },
  { match: /owns a space, which holds compliance history/i, key: 'errors.accountOwnsSpace' },
  { match: /You own a space, which holds your company/i, key: 'errors.deleteAccountOwnsSpace' },
  { match: /holds platform access/i, key: 'errors.accountHasAccess' },
  { match: /access period has already ended/i, key: 'errors.accessPeriodEnded' },
  { match: /Built-in languages cannot be removed/i, key: 'errors.builtinLanguage' },
  {
    match: /free plan must cost nothing|Whether a plan is free|plan code cannot be changed/i,
    key: 'errors.planEditRefused',
  },

  // Last: the general refusals the specific ones above were protected from.
  { match: /Only the owner can/i, key: 'errors.ownerOnly' },
  { match: /do not have permission/i, key: 'errors.noPermission' },
];

/**
 * A database refusal in the reader's language, or `undefined` if it is not one
 * this file recognises.
 *
 * Returns undefined rather than a guess so a caller can decide what an
 * unrecognised failure should say in its own context — see
 * `describeDatabaseError` for the usual answer.
 */
export function translateDatabaseError(
  message: string | undefined,
  t: Translate,
): string | undefined {
  if (!message) return undefined;

  for (const rule of DATABASE_RULES) {
    const m = message.match(rule.match);
    if (m) return t(rule.key, rule.values?.(m));
  }

  return undefined;
}

/**
 * Always a sentence: the translation when there is one, the original message
 * when there is not, and a translated "something went wrong" only when there is
 * no message at all.
 */
export function describeDatabaseError(message: string | undefined, t: Translate): string {
  return translateDatabaseError(message, t) ?? message ?? t('errors.unknown');
}

/**
 * Validation messages from the shared schemas, translated.
 *
 * The schemas in `packages/core` carry message KEYS rather than English, so a
 * field error arrives here as `errors.emailInvalid` and leaves in the reader's
 * language. A message Zod wrote itself — a built-in check nobody gave a custom
 * message — is not a key, and `t` hands it back unchanged, which is the right
 * fallback: English beats a blank.
 */
export function translateFieldErrors(
  fieldErrors: { [field: string]: string[] | undefined },
  t: Translate,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [field, messages] of Object.entries(fieldErrors)) {
    if (!messages?.length) continue;
    out[field] = messages.map((message) => t(message));
  }
  return out;
}

/*
 * Supabase Auth's own messages. These are its wording, not ours, so only the
 * ones a person commonly meets are recognised; anything else passes through.
 */
const AUTH_RULES: Rule[] = [
  { match: /captcha/i, key: 'errors.captchaFailed' },
  { match: /already (been )?registered|user already exists/i, key: 'errors.authAlreadyRegistered' },
  { match: /rate limit|too many/i, key: 'errors.authRateLimit' },
  { match: /different from the old password/i, key: 'errors.authSamePassword' },
  { match: /password should be at least/i, key: 'errors.passwordTooShort' },
  { match: /invalid.*email|email.*invalid/i, key: 'errors.emailInvalid' },
];

export function translateAuthError(message: string | undefined, t: Translate): string {
  if (!message) return t('errors.unknown');

  for (const rule of AUTH_RULES) {
    if (rule.match.test(message)) return t(rule.key);
  }

  return message;
}

/**
 * The usual shape of a failed write, in one call.
 *
 * The translated refusal when the database said something recognised above;
 * otherwise the action's own "Could not save: …" sentence, with its prefix in
 * the reader's language and the database's words after it.
 *
 * A recognised refusal is NOT prefixed. "Could not create the space: You have
 * reached the number of spaces your plan includes" is two sentences saying one
 * thing, and the refusal on its own is the clearer answer.
 */
export function explainFailure(
  message: string | undefined,
  fallbackKey: string,
  t: Translate,
): string {
  return (
    translateDatabaseError(message, t) ?? t(fallbackKey, { reason: message ?? t('errors.unknown') })
  );
}

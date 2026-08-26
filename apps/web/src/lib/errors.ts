/**
 * Turning database refusals into sentences.
 *
 * The triggers raise deliberately matchable text. This translates the ones a
 * person can act on, and returns undefined for everything else — so an
 * unrelated failure is never mislabelled, which would send someone off
 * archiving spaces to fix a network error.
 *
 * A plain module rather than living beside the actions: files marked
 * `'use server'` may only export async functions, so a shared helper cannot sit
 * in one. Both `lib/boards/actions.ts` and `lib/schedules/actions.ts` invite
 * people, and the same refusal should read the same way in both.
 */
export function friendlyDatabaseError(message: string | undefined): string | undefined {
  if (!message) return undefined;

  if (message.includes('Space limit reached')) {
    return 'You have reached the number of spaces your plan includes. Archive one you are no longer using, or move up a plan.';
  }

  if (message.includes('Member limit reached')) {
    return 'You have reached the number of people your plan includes. Archive a space you are no longer using, or move up a plan.';
  }

  // Not a plan problem and not the person's fault — they are simply going fast.
  // "Wait a few minutes" matters: without it this reads as a refusal, and
  // somebody onboarding a shift will conclude the product is broken.
  if (message.includes('Rate limit reached')) {
    return 'That is a lot of invitations at once. Wait a few minutes and continue — the ones already sent are fine.';
  }

  return undefined;
}

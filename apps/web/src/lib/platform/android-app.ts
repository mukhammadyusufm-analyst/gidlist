import 'server-only';

import { cookies } from 'next/headers';

/** Set by `proxy.ts` when the request came from the Google Play app. */
export const ANDROID_APP_COOKIE = 'android_app';

/**
 * Is this page being shown inside the Google Play app?
 *
 * Play's payments policy: an app that sells digital services must use Google
 * Play Billing, or else show no prices and no way to buy elsewhere. Gidlist is
 * sold by invoice, so inside the app it shows the plan and its usage and leaves
 * prices, plan comparisons and payment out.
 */
export async function isAndroidApp(): Promise<boolean> {
  return (await cookies()).get(ANDROID_APP_COOKIE)?.value === '1';
}

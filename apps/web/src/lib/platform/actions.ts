'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

export type GrantResult = { error?: string; notice?: string };

/**
 * Give or take a platform capability.
 *
 * Every meaningful check is in the database: `set_platform_grant` verifies the
 * caller holds `grants`, and refuses to hand out `grants` itself. This function
 * deliberately re-checks neither. Duplicating a security rule in two places is
 * how the two drift apart, and the copy in app code is the one that gets edited
 * without thinking.
 */
export async function setPlatformGrant(
  _prev: GrantResult,
  formData: FormData,
): Promise<GrantResult> {
  const userId = String(formData.get('userId') ?? '');
  const capability = String(formData.get('capability') ?? '');
  const granted = String(formData.get('granted') ?? '') === 'true';

  const supabase = await createClient();
  const { error } = await supabase.rpc('set_platform_grant', {
    p_user_id: userId,
    p_capability: capability,
    p_granted: granted,
  });

  if (error) {
    return {
      error: error.message.includes('only be granted directly in the database')
        ? 'That capability can only be granted with SQL, so nobody can promote themselves from inside the app.'
        : error.message,
    };
  }

  revalidatePath('/dashboard/admin/access');
  return { notice: granted ? 'Access granted.' : 'Access removed.' };
}

/**
 * Grant, or remove, every capability a person can hold — except root.
 *
 * Asked for as "unlimited access". This is convenience only and confers no
 * power the screen did not already hand out one checkbox at a time; that is
 * exactly why it is safe to build.
 *
 * ROOT IS EXCLUDED, AND THE EXCLUSION IS THE POINT. The `grants` capability is
 * settable only with SQL, because anyone holding `grants` can already grant
 * `grants` — so if this could confer root too, any grants-holder could make
 * themselves root in one click, and no capability would remain that the
 * interface cannot confer on itself. Escalation has to need a database console,
 * not a session.
 *
 * The filter is `is_root` in the data rather than the literal string "grants",
 * so a second root-like capability added later is excluded automatically. The
 * database refuses root regardless; this is the second lock, not the only one.
 */
export async function setAllPlatformGrants(
  _prev: GrantResult,
  formData: FormData,
): Promise<GrantResult> {
  const userId = String(formData.get('userId') ?? '');
  const granted = String(formData.get('granted') ?? '') === 'true';

  const supabase = await createClient();

  const { data: capabilities, error: listError } = await supabase
    .from('platform_capabilities')
    .select('code')
    .eq('is_root', false)
    .order('sort_order');

  if (listError) return { error: listError.message };
  if (!capabilities?.length) return { error: 'No capabilities to grant.' };

  // Sequentially, so a failure halfway leaves a state that can be read off the
  // screen rather than an unknown mixture from parallel writes.
  for (const { code } of capabilities) {
    const { error } = await supabase.rpc('set_platform_grant', {
      p_user_id: userId,
      p_capability: code,
      p_granted: granted,
    });
    // Naming the capability that failed, because "it didn't work" on a
    // five-step loop leaves nothing to act on.
    if (error) return { error: `Stopped at "${code}": ${error.message}` };
  }

  revalidatePath('/dashboard/admin/access');
  return {
    notice: granted
      ? 'All access granted, except the root capability, which needs SQL.'
      : 'All access removed.',
  };
}

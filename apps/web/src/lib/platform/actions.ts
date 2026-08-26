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

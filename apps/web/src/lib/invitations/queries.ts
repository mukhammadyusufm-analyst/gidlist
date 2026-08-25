import 'server-only';

import { createClient, getUser } from '@/lib/supabase/server';
import type { BoardRole } from '@/lib/supabase/database.types';

export type PendingInvitation = {
  id: string;
  boardName: string;
  role: BoardRole;
  invitedAt: string;
};

/**
 * Invitations addressed to the signed-in person and not yet answered.
 *
 * The space name has to be fetched separately rather than joined: an invitation
 * is not a membership, so Row Level Security does not let the invitee read the
 * `boards` row yet — which is the whole point. A dedicated function reads just
 * the name, on the reasoning that being told which space you have been invited
 * to reveals nothing you were not already being told by the invitation itself.
 */
export async function listPendingInvitations(): Promise<PendingInvitation[]> {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('board_members')
    .select('id, board_id, role, created_at')
    .eq('user_id', user.id)
    .eq('status', 'invited')
    .order('created_at', { ascending: false });

  if (!data?.length) return [];

  const { data: names } = await supabase.rpc('invited_board_names', {
    p_board_ids: data.map((row) => row.board_id),
  });

  const byId = new Map((names ?? []).map((n) => [n.board_id, n.name]));

  return data.map((row) => ({
    id: row.id,
    boardName: byId.get(row.board_id) ?? 'A space',
    role: row.role,
    invitedAt: row.created_at,
  }));
}

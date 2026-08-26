import 'server-only';

import { cache } from 'react';

import { createClient } from '@/lib/supabase/server';
import type { Board, BoardMember } from '@/lib/supabase/database.types';

/**
 * Board reads.
 *
 * None of these filter by user. They do not need to — Row Level Security
 * already restricts every row to boards the caller belongs to, so a plain
 * `select *` returns exactly their boards and nothing else. Adding a redundant
 * `.eq('owner_id', user.id)` here would actually be a downgrade: it would
 * silently hide boards the user was invited to but does not own.
 */

export async function listMyBoards(includeArchived = false): Promise<Board[]> {
  const supabase = await createClient();
  const query = supabase.from('boards').select('*').order('name');

  // Archived spaces are hidden rather than gone. Their compliance history stays
  // readable, and they can be brought back — but they should not clutter the
  // list of places someone actually works.
  if (!includeArchived) query.is('archived_at', null);

  const { data, error } = await query;
  if (error) throw new Error(`Could not load boards: ${error.message}`);
  return data ?? [];
}

export async function getBoardBySlug(slug: string): Promise<Board | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('boards').select('*').eq('slug', slug).maybeSingle();

  // A board the user cannot see is filtered out by RLS and arrives here as
  // `null`, indistinguishable from one that does not exist. That is the
  // intended behaviour: it avoids confirming that a given board exists to
  // someone with no access to it.
  if (error) throw new Error(`Could not load board: ${error.message}`);
  return data;
}

export type MemberWithProfile = BoardMember & {
  full_name: string | null;
  avatar_url: string | null;
};

export async function listBoardMembers(boardId: string): Promise<MemberWithProfile[]> {
  const supabase = await createClient();

  const { data: members, error } = await supabase
    .from('board_members')
    .select('*')
    .eq('board_id', boardId)
    .order('created_at');

  if (error) throw new Error(`Could not load members: ${error.message}`);
  if (!members?.length) return [];

  // Fetched separately rather than as a PostgREST embed. `board_members.user_id`
  // points at auth.users, not profiles, so there is no foreign key for PostgREST
  // to follow. Adding one would be neater but is a trap: the invite-claiming
  // trigger runs before the profile row exists, so the constraint would reject
  // every signup that had a pending invitation.
  const userIds = members.map((m) => m.user_id).filter((id): id is string => id !== null);

  const profilesById = new Map<string, { full_name: string; avatar_url: string | null }>();

  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', userIds);

    for (const p of profiles ?? []) {
      profilesById.set(p.id, { full_name: p.full_name, avatar_url: p.avatar_url });
    }
  }

  return members.map((m) => {
    const profile = m.user_id ? profilesById.get(m.user_id) : undefined;
    return {
      ...m,
      full_name: profile?.full_name ?? null,
      avatar_url: profile?.avatar_url ?? null,
    };
  });
}

/**
 * The caller's role on a board, or null if they are not a member.
 *
 * Used to decide what the UI offers. It is not a security boundary — the
 * database enforces the same rules regardless of what the interface shows.
 */
export const getMyRole = cache(
  async (boardId: string): Promise<BoardMember['role'] | null> => {
    const supabase = await createClient();

    // One round trip, not two. `my_role` reads auth.uid() from the request's
    // JWT inside the database, so there is no need to verify the token over the
    // network first and then query with the id it returns.
    const { data } = await supabase.rpc('my_role', { p_board_id: boardId });

    return (data as BoardMember['role'] | null) ?? null;
  },
);

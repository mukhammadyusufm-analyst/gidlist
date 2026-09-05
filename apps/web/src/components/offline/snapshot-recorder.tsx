'use client';

import { useEffect } from 'react';

import { rememberUser, saveSnapshot, type SubmissionSnapshot } from '@/lib/offline/snapshot';

/**
 * Keeps a copy of this checklist on the device, every time it is opened online.
 *
 * Renders nothing. It sits on the fill page and writes what is already on
 * screen into IndexedDB, so the same checklist can be opened later with no
 * signal — which is the half the write queue could not provide on its own. The
 * queue made ticking work once a page was open; without this, getting the page
 * open at all needed a connection, so the whole feature only helped somebody
 * who had thought ahead.
 *
 * Written on every visit rather than once, because the point is freshness: the
 * copy is only as good as the last time there was signal, and each visit is a
 * free chance to improve it.
 */
export function SnapshotRecorder({ snapshot }: { snapshot: Omit<SubmissionSnapshot, 'savedAt'> }) {
  useEffect(() => {
    /*
     * `void` rather than awaited, and failures are the store's problem.
     *
     * Nothing on this page depends on the copy succeeding — the checklist is
     * already rendered from the server. A device with storage blocked should
     * lose the offline copy and nothing else.
     */
    rememberUser(snapshot.userId);
    void saveSnapshot({ ...snapshot, savedAt: Date.now() });
    // Keyed on the submission and its tick count, so returning to a checklist
    // after ticking something re-saves it, while re-renders that changed
    // nothing do not.
  }, [snapshot]);

  return null;
}

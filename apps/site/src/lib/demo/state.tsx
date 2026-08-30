'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { DEMO, type DemoSpace, type Requirement } from '@/lib/demo/data';
import type { BuiltinLocale } from '@/lib/i18n/locale';

/**
 * One demo dataset for the whole page.
 *
 * WHY A CONTEXT AND NOT LOCAL STATE PER MODULE. The page has to behave like the
 * product, and the product is one system: choosing a space in one scene changes
 * the checklists, the evidence and the charts in every scene after it. Modules
 * that each held their own state would be a row of unrelated widgets that happen
 * to sit on the same page.
 *
 * NOTHING IS PERSISTED. No `localStorage`, no `sessionStorage` — everything here
 * lives in memory for the length of the visit, which is all a demo needs and
 * avoids leaving anything on a stranger's machine.
 *
 * THE LEDGER IS THE POINT. Every action a visitor takes appends a stamped entry,
 * so by the bottom of the page they are looking at an audit trail of their own
 * visit. That is the product's thesis performed rather than described, and it is
 * why this file owns the ledger instead of any single component.
 */

export type LedgerEntry = {
  id: number;
  /** Fixed scene time, never the visitor's clock — see the note in `data.ts`. */
  at: string;
  text: string;
  tone: 'done' | 'blocked' | 'change';
};

type DemoState = {
  locale: BuiltinLocale;
  space: DemoSpace;
  spaces: DemoSpace[];
  words: (typeof DEMO)[BuiltinLocale]['words'];

  chooseSpace: (id: string) => void;

  /** Task ids the visitor has ticked, for the current space. */
  ticked: Set<string>;
  /**
   * Only flips the tick. Writing the ledger entry is left to the caller, which
   * is the only place that knows how to phrase it in the reader's language.
   */
  toggleTask: (taskId: string) => void;

  /** Enforcement the visitor has set in the sandbox. Three independent rules. */
  photoRule: Requirement;
  fileRule: Requirement;
  locationRule: Requirement;
  setPhotoRule: (value: Requirement) => void;
  setFileRule: (value: Requirement) => void;
  setLocationRule: (value: Requirement) => void;

  /** What the sandbox has supplied so far. */
  hasPhoto: boolean;
  hasFile: boolean;
  hasLocation: boolean;
  setHasPhoto: (value: boolean) => void;
  setHasFile: (value: boolean) => void;
  setHasLocation: (value: boolean) => void;

  ledger: LedgerEntry[];
  note: (text: string, tone: LedgerEntry['tone'], at: string) => void;
  reset: () => void;
};

const Ctx = createContext<DemoState | null>(null);

export function DemoProvider({
  locale,
  children,
}: {
  locale: BuiltinLocale;
  children: ReactNode;
}) {
  const pack = DEMO[locale];

  const [spaceId, setSpaceId] = useState(pack.spaces[0].id);
  const [ticked, setTicked] = useState<Set<string>>(() => new Set());
  const [photoRule, setPhotoRule] = useState<Requirement>('required');
  const [fileRule, setFileRule] = useState<Requirement>('offered');
  const [locationRule, setLocationRule] = useState<Requirement>('offered');
  const [hasPhoto, setHasPhoto] = useState(false);
  const [hasFile, setHasFile] = useState(false);
  const [hasLocation, setHasLocation] = useState(false);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);

  const space = useMemo(
    () => pack.spaces.find((s) => s.id === spaceId) ?? pack.spaces[0],
    [pack.spaces, spaceId],
  );

  const note = useCallback((text: string, tone: LedgerEntry['tone'], at: string) => {
    setLedger((current) => {
      // Capped, and the newest wins. An unbounded list would grow for as long as
      // somebody kept clicking, and nobody reads the fortieth entry.
      const next = [...current, { id: current.length, at, text, tone }];
      return next.slice(-12);
    });
  }, []);

  const toggleTask = useCallback((taskId: string) => {
    setTicked((current) => {
      const next = new Set(current);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  const chooseSpace = useCallback((id: string) => {
    setSpaceId(id);
    // Ticks belong to the checklist they were made against, so switching space
    // clears them rather than carrying a tick from a depot into a clinic.
    setTicked(new Set());
  }, []);

  const reset = useCallback(() => {
    setTicked(new Set());
    setHasPhoto(false);
    setHasFile(false);
    setHasLocation(false);
    setLedger([]);
  }, []);

  const value = useMemo<DemoState>(
    () => ({
      locale,
      space,
      spaces: pack.spaces,
      words: pack.words,
      chooseSpace,
      ticked,
      toggleTask,
      photoRule,
      fileRule,
      locationRule,
      setPhotoRule,
      setFileRule,
      setLocationRule,
      hasPhoto,
      hasFile,
      hasLocation,
      setHasPhoto,
      setHasFile,
      setHasLocation,
      ledger,
      note,
      reset,
    }),
    [
      locale,
      space,
      pack.spaces,
      pack.words,
      chooseSpace,
      ticked,
      toggleTask,
      photoRule,
      fileRule,
      locationRule,
      hasPhoto,
      hasFile,
      hasLocation,
      ledger,
      note,
      reset,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * Read the demo state.
 *
 * Throws rather than returning null if a module is rendered outside the
 * provider: that is a wiring mistake, and a component that silently renders an
 * empty demo is far harder to notice than one that fails at the boundary.
 */
export function useDemo(): DemoState {
  const value = useContext(Ctx);
  if (!value) throw new Error('useDemo must be used inside <DemoProvider>');
  return value;
}

'use client';

import { useState } from 'react';
import { Camera, Check, FileText, MapPin, TriangleAlert } from 'lucide-react';

import type { Requirement } from '@/lib/demo/data';
import { useDemo } from '@/lib/demo/state';

/**
 * The turn in the story: try to submit without what the task demands, and fail.
 *
 * This is the one module that has to actually work rather than merely
 * illustrate. Every other claim on this page can be shown; "the checklist cannot
 * be gamed" can only be *demonstrated*, by letting a visitor try it and watching
 * the button refuse them. A screenshot of a disabled button proves nothing — a
 * disabled button they just pressed proves the whole thesis.
 *
 * So the rules here are the real ones. Photo, file and location are three
 * independent switches, each with three states — off, offered, required — which
 * is exactly the model in the product: a photo can be mandatory while a document
 * is merely offered and location is not asked for at all, in any combination.
 *
 * WHAT THE REFUSAL SAYS. Not "invalid" and not "required fields missing", but
 * the specific thing that is absent, in the words the interface uses for it.
 * Somebody blocked by a rule has usually done nothing wrong; they need to know
 * what to do next, which is the brandbook's rule for refusals.
 */

const CYCLE: Requirement[] = ['off', 'offered', 'required'];

export function EnforcementSandbox({
  labels,
}: {
  labels: {
    task: string;
    submit: string;
    submitted: string;
    blockedPrefix: string;
    takePhoto: string;
    photoTaken: string;
    attachFile: string;
    fileAttached: string;
    getLocation: string;
    locationOn: string;
    rules: string;
    tryIt: string;
    blockedEntry: string;
    passedEntry: string;
    reset: string;
  };
}) {
  const {
    words,
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
    note,
  } = useDemo();

  const [state, setState] = useState<'idle' | 'blocked' | 'passed'>('idle');
  const [missing, setMissing] = useState<string[]>([]);

  const wordFor: Record<Requirement, string> = {
    off: words.off,
    offered: words.offered,
    required: words.required,
  };

  function whatIsMissing(): string[] {
    const gaps: string[] = [];
    if (photoRule === 'required' && !hasPhoto) gaps.push(words.photo);
    if (fileRule === 'required' && !hasFile) gaps.push(words.file);
    if (locationRule === 'required' && !hasLocation) gaps.push(words.location);
    return gaps;
  }

  function submit() {
    const gaps = whatIsMissing();
    if (gaps.length > 0) {
      setMissing(gaps);
      setState('blocked');
      note(labels.blockedEntry.replace('{missing}', gaps.join(', ')), 'blocked', '06:15');
      return;
    }
    setMissing([]);
    setState('passed');
    note(labels.passedEntry, 'done', '06:15');
  }

  function cycleRule(which: 'photo' | 'file' | 'location') {
    const current = which === 'photo' ? photoRule : which === 'file' ? fileRule : locationRule;
    const next = CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length];
    if (which === 'photo') setPhotoRule(next);
    else if (which === 'file') setFileRule(next);
    else setLocationRule(next);
    // Changing the rule invalidates the last verdict — leaving "submitted" on
    // screen after somebody tightens a rule would be a lie.
    setState('idle');
  }

  const blocked = state === 'blocked';
  const passed = state === 'passed';

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-e2 sm:p-6">
      {/* ---- the rules ---- */}
      <p className="font-mono text-xs tracking-[0.09em] text-[var(--color-muted-foreground)] uppercase">
        {labels.rules}
      </p>

      {/* Three rules, three states each. They are laid out side by side so the
          independence is visible: nothing here implies that turning one on turns
          another on, because in the product it does not. */}
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {(
          [
            ['photo', photoRule, words.photo, Camera] as const,
            ['file', fileRule, words.file, FileText] as const,
            ['location', locationRule, words.location, MapPin] as const,
          ]
        ).map(([which, rule, label, Icon]) => (
          <button
            key={which}
            type="button"
            onClick={() => cycleRule(which)}
            className="flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--color-border)] p-3 text-left transition-colors hover:border-[var(--color-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]"
          >
            <Icon className="size-4 shrink-0 text-[var(--color-muted-foreground)]" aria-hidden="true" />
            <span className="flex-1 text-sm">{label}</span>
            <span
              className={`rounded px-1.5 py-0.5 font-mono text-[0.6rem] ${
                rule === 'required'
                  ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                  : 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]'
              }`}
            >
              {wordFor[rule]}
            </span>
          </button>
        ))}
      </div>

      {/* ---- the task ---- */}
      <div className="mt-5 rounded-xl border border-[var(--color-border)] p-4">
        <p className="text-sm font-medium sm:text-base">{labels.task}</p>

        <div className="mt-3 flex flex-wrap gap-2">
          {photoRule !== 'off' ? (
            <button
              type="button"
              onClick={() => {
                setHasPhoto(!hasPhoto);
                setState('idle');
              }}
              aria-pressed={hasPhoto}
              className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)] ${
                hasPhoto
                  ? 'border-[var(--color-success)] bg-[var(--color-success)]/10 text-[var(--color-success)]'
                  : 'border-[var(--color-border)] hover:border-[var(--color-primary)]'
              }`}
            >
              {hasPhoto ? <Check className="size-3.5" aria-hidden="true" /> : <Camera className="size-3.5" aria-hidden="true" />}
              {hasPhoto ? labels.photoTaken : labels.takePhoto}
            </button>
          ) : null}

          {fileRule !== 'off' ? (
            <button
              type="button"
              onClick={() => {
                setHasFile(!hasFile);
                setState('idle');
              }}
              aria-pressed={hasFile}
              className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)] ${
                hasFile
                  ? 'border-[var(--color-success)] bg-[var(--color-success)]/10 text-[var(--color-success)]'
                  : 'border-[var(--color-border)] hover:border-[var(--color-primary)]'
              }`}
            >
              {hasFile ? (
                <Check className="size-3.5" aria-hidden="true" />
              ) : (
                <FileText className="size-3.5" aria-hidden="true" />
              )}
              {hasFile ? `${labels.fileAttached} · ${words.fileName}` : labels.attachFile}
            </button>
          ) : null}

          {locationRule !== 'off' ? (
            <button
              type="button"
              onClick={() => {
                setHasLocation(!hasLocation);
                setState('idle');
              }}
              aria-pressed={hasLocation}
              className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)] ${
                hasLocation
                  ? 'border-[var(--color-success)] bg-[var(--color-success)]/10 text-[var(--color-success)]'
                  : 'border-[var(--color-border)] hover:border-[var(--color-primary)]'
              }`}
            >
              {hasLocation ? <Check className="size-3.5" aria-hidden="true" /> : <MapPin className="size-3.5" aria-hidden="true" />}
              {hasLocation ? labels.locationOn : labels.getLocation}
            </button>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={submit}
            className="cursor-pointer rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-sm font-medium text-[var(--color-primary-foreground)] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]"
          >
            {labels.submit}
          </button>

          {state === 'idle' ? (
            <span className="font-mono text-xs text-[var(--color-muted-foreground)]">
              {labels.tryIt}
            </span>
          ) : null}

          {passed ? (
            <button
              type="button"
              onClick={() => {
                setHasPhoto(false);
                setHasFile(false);
                setHasLocation(false);
                setState('idle');
              }}
              className="cursor-pointer font-mono text-xs text-[var(--color-muted-foreground)] underline-offset-4 hover:underline"
            >
              {labels.reset}
            </button>
          ) : null}
        </div>

        {/*
          The verdict, announced. `aria-live` matters more here than anywhere
          else on the page: the entire point is that pressing the button did
          something, and a sighted visitor sees red appear while a screen-reader
          user would otherwise be told nothing at all.
        */}
        <p role="status" aria-live="assertive" className="mt-3 min-h-6 text-sm">
          {blocked ? (
            <span className="flex items-start gap-2 text-[var(--color-destructive)]">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span className="text-pretty">
                {labels.blockedPrefix} {missing.join(', ')}
              </span>
            </span>
          ) : null}

          {passed ? (
            <span className="flex items-start gap-2 text-[var(--color-success)]">
              <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span className="text-pretty">{labels.submitted}</span>
            </span>
          ) : null}
        </p>
      </div>
    </div>
  );
}

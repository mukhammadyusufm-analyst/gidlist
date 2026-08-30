'use client';

import { useRef, useState, useTransition } from 'react';
import {
  DEFAULT_BANNER_FRAMING,
  parseBannerValue,
  type BannerFit,
  type BannerFraming as Framing,
} from '@app/core/appearance';

import { setBannerFraming } from '@/lib/media/actions';
import { Button } from '@/components/ui/button';
import { FormNotice } from '@/components/ui/field-error';
import { useT } from '@/components/i18n/provider';
import { cn } from '@/lib/utils';
import type { UploadTarget } from '@/components/ui/image-upload-form';

/**
 * Choose how an uploaded banner sits in the 3:1 strip.
 *
 * The preview is the real thing at the real aspect ratio, not a diagram of it.
 * Framing is the kind of decision nobody can make from a description — you move
 * the point and see whether the face is still in shot — so the control has to be
 * the outcome rather than a set of numbers describing it.
 *
 * Saved explicitly on a button rather than on every drag. A pointer move fires
 * dozens of times a second, and writing on each one would be dozens of round
 * trips to reposition one photograph.
 */
export function BannerFramingControl({
  current,
  target,
}: {
  current: string;
  target: Extract<UploadTarget, { kind: 'board' } | { kind: 'checklist' }>;
}) {
  const { src, framing: saved } = parseBannerValue(current);

  const [framing, setFraming] = useState<Framing>(saved);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const { t } = useT();

  const dirty =
    framing.fit !== saved.fit ||
    framing.focusX !== saved.focusX ||
    framing.focusY !== saved.focusY;

  /** Translate a pointer position into a percentage within the preview. */
  function pointTo(clientX: number, clientY: number) {
    const box = frameRef.current?.getBoundingClientRect();
    if (!box || box.width === 0 || box.height === 0) return;

    setDone(false);
    setFraming((f) => ({
      ...f,
      focusX: Math.min(100, Math.max(0, Math.round(((clientX - box.left) / box.width) * 100))),
      focusY: Math.min(100, Math.max(0, Math.round(((clientY - box.top) / box.height) * 100))),
    }));
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (framing.fit === 'contain') return;
    // Capture so a drag that leaves the preview keeps tracking, instead of
    // stopping at the edge and leaving the point somewhere the author did not
    // choose.
    event.currentTarget.setPointerCapture(event.pointerId);
    pointTo(event.clientX, event.clientY);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (framing.fit === 'contain') return;
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    pointTo(event.clientX, event.clientY);
  }

  /** Arrow keys move the point, so this is not a mouse-only control. */
  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (framing.fit === 'contain') return;

    const step = event.shiftKey ? 10 : 2;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = moves[event.key];
    if (!move) return;

    event.preventDefault();
    setDone(false);
    setFraming((f) => ({
      ...f,
      focusX: Math.min(100, Math.max(0, f.focusX + move[0])),
      focusY: Math.min(100, Math.max(0, f.focusY + move[1])),
    }));
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await setBannerFraming({ target, framing });
      if (result.error) setError(result.error);
      else setDone(true);
    });
  }

  const fits: BannerFit[] = ['cover', 'contain'];

  return (
    <div className="space-y-3">
      {error ? <FormNotice kind="error">{error}</FormNotice> : null}

      <div
        ref={frameRef}
        role="application"
        aria-label={t('media.focalPoint')}
        tabIndex={framing.fit === 'cover' ? 0 : -1}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onKeyDown={handleKeyDown}
        className={cn(
          'relative aspect-[3/1] w-full overflow-hidden rounded-xl border border-[var(--color-border)]',
          framing.fit === 'cover'
            ? 'cursor-crosshair touch-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]'
            : 'bg-[var(--color-muted)]',
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          draggable={false}
          className="pointer-events-none size-full select-none"
          style={{
            objectFit: framing.fit,
            objectPosition: `${framing.focusX}% ${framing.focusY}%`,
          }}
        />

        {framing.fit === 'cover' ? (
          <span
            aria-hidden="true"
            style={{ left: `${framing.focusX}%`, top: `${framing.focusY}%` }}
            // Ring plus dot: a single colour would disappear against a photo
            // that happens to match it, and a banner is usually a photograph.
            className="pointer-events-none absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_2px_rgba(0,0,0,0.55)]"
          >
            <span className="absolute left-1/2 top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border border-[var(--color-border)] p-0.5">
          {fits.map((fit) => (
            <button
              key={fit}
              type="button"
              aria-pressed={framing.fit === fit}
              onClick={() => {
                setDone(false);
                setFraming((f) => ({ ...f, fit }));
              }}
              className={cn(
                'rounded px-3 py-1 text-sm transition-colors',
                framing.fit === fit
                  ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                  : 'text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]',
              )}
            >
              {fit === 'cover' ? t('media.fitFill') : t('media.fitWhole')}
            </button>
          ))}
        </div>

        <Button type="button" size="sm" disabled={!dirty || pending} onClick={save}>
          {t('media.saveFraming')}
        </Button>

        {framing.fit !== DEFAULT_BANNER_FRAMING.fit ||
        framing.focusX !== DEFAULT_BANNER_FRAMING.focusX ||
        framing.focusY !== DEFAULT_BANNER_FRAMING.focusY ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => {
              setDone(false);
              setFraming(DEFAULT_BANNER_FRAMING);
            }}
          >
            {t('common.reset')}
          </Button>
        ) : null}

        {done ? (
          <span className="text-sm text-[var(--color-muted-foreground)]">{t('common.saved')}</span>
        ) : null}
      </div>

      <p className="text-sm text-[var(--color-muted-foreground)]">
        {framing.fit === 'cover' ? t('media.focalHint') : t('media.containHint')}
      </p>
    </div>
  );
}

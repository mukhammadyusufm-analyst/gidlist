'use client';

import { useState } from 'react';
import { Camera, Check, ChevronLeft, ChevronRight, RotateCcw, Users } from 'lucide-react';

import type { SiteMessages } from '@app/core';

import type { ClosingCopy } from '@/lib/closing-copy';

/**
 * The flagship scene: one employee, one morning, five steps.
 *
 * WHY ATTENDANCE. It is the case where the old method is weakest — a signature
 * on a sheet proves that a pen was there, and nothing else — so it is where the
 * difference between a tick and a record is easiest to feel.
 *
 * WHAT IS NOT IN IT. No submission time window. The obvious dramatic beat would
 * be "the window is open, you are on time", and the product cannot enforce a
 * window yet. Everything staged here is something the product actually does.
 *
 * ADVANCES ON CLICK, NEVER ON SCROLL. A scroll-driven walkthrough takes the page
 * away from the reader and behaves unpredictably on the phones this product is
 * used on. It is skippable, it can be replayed, and the written version below is
 * not a fallback — it is the same content, always present, which is what makes
 * the scene work for a screen reader rather than merely not crash on one.
 */

// One icon per step. Step three now covers photo, file and location together,
// which is how the product actually asks for them — in one moment, not three.
const ICONS = [Users, Check, Camera, Check, Users];

export function AttendanceWalkthrough({
  steps,
  controls,
}: {
  steps: SiteMessages['walkSteps'];
  controls: ClosingCopy['walkthrough'];
}) {
  const [step, setStep] = useState(0);
  const total = steps.length;
  const current = steps[step];
  const Icon = ICONS[step];
  const last = step === total - 1;

  return (
    <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
      {/* ---- the phone ---- */}
      <div className="order-2 lg:order-1">
        <div className="mx-auto w-full max-w-[19rem]">
          {/* A device frame, drawn rather than photographed: a stock photo of a
              hand holding a phone would say nothing this does not. */}
          <div className="rounded-[2rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 shadow-e3">
            <div className="relative flex aspect-[9/17] flex-col overflow-hidden rounded-[1.5rem] bg-[var(--color-background)]">
              <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
                <span className="font-mono text-[0.6rem] text-[var(--color-muted-foreground)]">
                  09:0{step}
                </span>
                <span className="font-mono text-[0.6rem] text-[var(--color-muted-foreground)]">
                  {controls.stepLabel} {step + 1}/{total}
                </span>
              </div>

              <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
                <span
                  className="grid size-14 place-items-center rounded-2xl transition-colors"
                  style={{
                    background:
                      step >= 3
                        ? 'color-mix(in oklch, var(--color-success) 15%, transparent)'
                        : 'color-mix(in oklch, var(--color-primary) 12%, transparent)',
                    color: step >= 3 ? 'var(--color-success)' : 'var(--color-primary)',
                  }}
                >
                  <Icon className="size-6" aria-hidden="true" />
                </span>

                <p className="text-sm font-medium text-pretty">{current.title}</p>
                <p className="font-mono text-[0.65rem] text-[var(--color-muted-foreground)]">
                  {current.caption}
                </p>
              </div>

              {/* One segment per step rather than a bar: the steps are discrete
                  and countable, and a bar would imply a continuum. */}
              <div className="flex gap-1 px-4 pb-4">
                {steps.map((_, index) => (
                  <span
                    key={index}
                    className="h-1 flex-1 rounded-full transition-colors"
                    style={{
                      background:
                        index <= step ? 'var(--color-primary)' : 'var(--color-border)',
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ---- the narration and controls ---- */}
      <div className="order-1 lg:order-2">
        <p className="font-mono text-xs tracking-[0.09em] text-[var(--color-primary)] uppercase">
          {controls.stepLabel} {step + 1} / {total}
        </p>

        {/* Announced, so the walkthrough is followable without seeing the phone. */}
        <div aria-live="polite">
          <h3 className="mt-3 text-2xl font-semibold tracking-tight text-balance">
            {current.title}
          </h3>
          <p className="mt-4 text-lg leading-relaxed text-pretty text-[var(--color-muted-foreground)]">
            {current.body}
          </p>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-[var(--color-input)] px-4 py-2.5 text-sm font-medium transition-colors hover:bg-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            {controls.back}
          </button>

          {last ? (
            <button
              type="button"
              onClick={() => setStep(0)}
              className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-medium text-[var(--color-primary-foreground)]"
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              {controls.replay}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(total - 1, s + 1))}
              className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-medium text-[var(--color-primary-foreground)]"
            >
              {controls.next}
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          )}

          {!last ? (
            <button
              type="button"
              onClick={() => setStep(total - 1)}
              className="cursor-pointer px-2 font-mono text-xs text-[var(--color-muted-foreground)] underline-offset-4 hover:underline"
            >
              {controls.skip}
            </button>
          ) : null}
        </div>

        {/*
          The whole walkthrough as prose, collapsed. Not a fallback for people
          who cannot use the stepper — it is there for anybody who would simply
          rather read five sentences than press Next five times.
        */}
        <details className="mt-8 rounded-xl border border-[var(--color-border)] p-4">
          <summary className="cursor-pointer text-sm font-medium">{controls.textVersion}</summary>
          <ol className="mt-4 flex flex-col gap-3">
            {steps.map((s, index) => (
              <li key={s.title} className="text-sm leading-relaxed">
                <span className="font-mono text-xs text-[var(--color-muted-foreground)]">
                  {index + 1}.
                </span>{' '}
                <strong className="font-medium">{s.title}.</strong>{' '}
                <span className="text-[var(--color-muted-foreground)]">{s.body}</span>
              </li>
            ))}
          </ol>
        </details>
      </div>
    </div>
  );
}

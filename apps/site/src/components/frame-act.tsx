import { ArrowRight, RotateCw } from 'lucide-react';

import type { SiteMessages } from '@app/core';
import { Reveal } from '@/components/reveal';

/**
 * Scene 3: the mental model, set against one the reader already has.
 *
 * The only comparison on the site, and it is deliberately structural rather
 * than competitive: a board is for work that ends, this is for work that
 * returns. No feature table, no scoring, nothing that misrepresents what a board
 * is good at — a comparison that punches down reads as insecurity, and the
 * distinction here is genuinely about shape, not quality.
 *
 * The two icons carry the whole idea: an arrow that leaves, and a cycle that
 * comes back.
 */
export function FrameAct({ m }: { m: SiteMessages }) {
  return (
    <Reveal stagger={0.1}>
      <div className="mx-auto max-w-2xl text-center">
        <p
          data-reveal
          className="font-mono text-xs tracking-[0.09em] text-[var(--color-primary)] uppercase"
        >
          {m.frameEyebrow}
        </p>
        <h2
          data-reveal
          className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
        >
          {m.frameTitle}
        </h2>
        <p
          data-reveal
          className="mt-5 text-lg leading-relaxed text-pretty text-[var(--color-muted-foreground)]"
        >
          {m.frameLead}
        </p>
      </div>

      <div className="mx-auto mt-12 grid max-w-4xl gap-4 sm:grid-cols-2">
        <div
          data-reveal
          className="rounded-2xl border border-[var(--color-border)] p-6"
        >
          <span className="grid size-10 place-items-center rounded-xl bg-[var(--color-muted)] text-[var(--color-muted-foreground)]">
            <ArrowRight className="size-5" aria-hidden="true" />
          </span>
          <h3 className="mt-4 font-semibold text-pretty">{m.frameEndsTitle}</h3>
          <p className="mt-2 leading-relaxed text-pretty text-[var(--color-muted-foreground)]">
            {m.frameEndsBody}
          </p>
        </div>

        {/* The accent sits on this one only. Both halves are true; one of them
            is what this product is, and the page should not be neutral about
            which. */}
        <div
          data-reveal
          className="rounded-2xl border border-[var(--color-primary)]/40 bg-[var(--color-primary)]/[0.04] p-6"
        >
          <span className="grid size-10 place-items-center rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
            <RotateCw className="size-5" aria-hidden="true" />
          </span>
          <h3 className="mt-4 font-semibold text-pretty">{m.frameReturnsTitle}</h3>
          <p className="mt-2 leading-relaxed text-pretty text-[var(--color-muted-foreground)]">
            {m.frameReturnsBody}
          </p>
        </div>
      </div>
    </Reveal>
  );
}

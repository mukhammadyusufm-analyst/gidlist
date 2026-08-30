import { ShieldCheck } from 'lucide-react';

import type { SiteMessages } from '@app/core';

import type { ClosingCopy } from '@/lib/closing-copy';
import { Reveal } from '@/components/reveal';
import { AttendanceWalkthrough } from '@/components/demo/attendance-walkthrough';

/**
 * Scenes 10 to 14: the flagship case, the other rooms, proof-of-scale, the
 * objections, and the close.
 *
 * All prose comes from `m` so the admin screen governs it. Two sections are also
 * *optional*: the traction figures and the objections. Both read a visibility
 * key, and both default to what makes sense before anybody has edited anything —
 * traction hidden, because empty numbers help nobody, and the objections shown,
 * because they answer real questions from the first day.
 */

/**
 * Drawn unless the key says `no`.
 *
 * Fails safe on purpose: a typo, an empty value or an unexpected word leaves the
 * content on the page. The failure mode of a hide-flag should be "still there",
 * never "silently gone from the site with nothing to indicate why".
 */
function isVisible(value: string): boolean {
  return value.trim().toLowerCase() !== 'no';
}

function Header({
  eyebrow,
  title,
  body,
}: {
  eyebrow?: string;
  title: string;
  body: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      {eyebrow ? (
        <p
          data-reveal
          className="font-mono text-xs tracking-[0.09em] text-[var(--color-primary)] uppercase"
        >
          {eyebrow}
        </p>
      ) : null}
      <h2
        data-reveal
        className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
      >
        {title}
      </h2>
      <p
        data-reveal
        className="mt-5 text-lg leading-relaxed text-pretty text-[var(--color-muted-foreground)]"
      >
        {body}
      </p>
    </div>
  );
}

/**
 * Numbers, once there are any.
 *
 * Hidden by default and editable in the site content editor: set the three
 * figures, then change `tractionVisibility` to anything other than `hidden`.
 * Shipping it visible-but-empty would put three em-dashes on the page, and
 * shipping it with invented figures would be worse than either.
 */
function Traction({ m }: { m: SiteMessages }) {
  if (!isVisible(m.tractionVisible)) return null;

  const metrics: [string, string][] = [
    [m.tractionSpacesValue, m.tractionSpacesLabel],
    [m.tractionSubmissionsValue, m.tractionSubmissionsLabel],
    [m.tractionMembersValue, m.tractionMembersLabel],
  ];

  return (
    <div className="mx-auto max-w-3xl rounded-2xl border border-[var(--color-border)] p-6">
      <p className="font-mono text-xs tracking-[0.09em] text-[var(--color-muted-foreground)] uppercase">
        {m.tractionLabel}
      </p>

      <dl className="mt-4 grid gap-4 sm:grid-cols-3">
        {metrics.map(([value, label]) => (
          <div key={label}>
            <dd className="font-mono text-2xl font-semibold tabular-nums">{value}</dd>
            <dt className="mt-1 text-xs text-[var(--color-muted-foreground)]">{label}</dt>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function ClosingScenes({
  m,
  copy,
  signupUrl,
  ctaLabel,
  part,
}: {
  m: SiteMessages;
  copy: ClosingCopy;
  signupUrl: string;
  ctaLabel: string;
  part: 'before-pricing' | 'after-pricing';
}) {
  if (part === 'after-pricing') {
    return <ObjectionsAndClose m={m} signupUrl={signupUrl} ctaLabel={ctaLabel} />;
  }

  return (
    <div className="flex flex-col">
      {/* 10 — the flagship, full width and self-contained */}
      <section className="border-y border-[var(--color-border)] bg-[var(--color-surface)]/40">
        <div className="mx-auto w-full max-w-6xl px-6 py-24 sm:py-28">
          <Reveal>
            <Header eyebrow={m.walkEyebrow} title={m.walkTitle} body={m.walkLead} />
          </Reveal>

          <div className="mt-14">
            <AttendanceWalkthrough steps={m.walkSteps} controls={copy.walkthrough} />
          </div>
        </div>
      </section>

      {/* 11 — the other rooms, scannable */}
      <section className="mx-auto w-full max-w-6xl px-6 py-24 sm:py-28">
        <Reveal stagger={0.07}>
          <Header eyebrow={m.casesEyebrow} title={m.casesTitle} body={m.casesLead} />

          <ul className="mt-12 grid gap-3 sm:grid-cols-2">
            {m.cases.map((item) => (
              <li
                key={item.name}
                data-reveal
                className="rounded-2xl border border-[var(--color-border)] p-5"
              >
                <h3 className="font-semibold text-pretty">{item.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-pretty text-[var(--color-muted-foreground)]">
                  {item.what}
                </p>
                <p className="mt-4 flex items-start gap-2 border-t border-[var(--color-border)] pt-3">
                  <ShieldCheck
                    className="mt-0.5 size-3.5 shrink-0 text-[var(--color-primary)]"
                    aria-hidden="true"
                  />
                  <span className="font-mono text-[0.65rem] leading-relaxed text-pretty text-[var(--color-muted-foreground)]">
                    <span className="uppercase">{m.casesEnforced}</span>
                    {' · '}
                    {item.enforced}
                  </span>
                </p>
              </li>
            ))}
          </ul>

          <div className="mt-12">
            <Traction m={m} />
          </div>
        </Reveal>
      </section>
    </div>
  );
}

function ObjectionsAndClose({
  m,
  signupUrl,
  ctaLabel,
}: {
  m: SiteMessages;
  signupUrl: string;
  ctaLabel: string;
}) {
  /*
   * Two ways an item leaves the page, and they mean different things.
   *
   * Unticking `visible` hides one question while keeping the text, which is what
   * somebody wants when an answer is temporarily wrong. A blank question drops
   * the slot entirely, which is how the unused spare slots stay out of the way.
   */
  const faqs = m.faqItems.filter((item) => item.q.trim().length > 0 && isVisible(item.visible));
  const showFaq = isVisible(m.faqVisible) && faqs.length > 0;

  return (
    <div className="flex flex-col">
      {showFaq ? (
        <section
          id="faq"
          className="border-y border-[var(--color-border)] bg-[var(--color-surface)]/40 scroll-mt-16"
        >
          <div className="mx-auto w-full max-w-3xl px-6 py-24 sm:py-28">
            <Reveal stagger={0.06}>
              <Header eyebrow={m.faqEyebrow} title={m.faqTitle} body={m.faqLead} />

              {/*
                `<details>` rather than a scripted accordion: it opens with no
                JavaScript, it is keyboard-operable for free, and find-in-page can
                reach the answers inside it.
              */}
              <div className="mt-12 flex flex-col gap-2">
                {faqs.map((item) => (
                  <details
                    key={item.q}
                    data-reveal
                    className="group rounded-xl border border-[var(--color-border)] px-5 open:bg-[var(--color-surface)]"
                  >
                    <summary className="cursor-pointer py-4 font-medium text-pretty marker:content-none">
                      {item.q}
                    </summary>
                    <p className="pb-4 leading-relaxed text-pretty text-[var(--color-muted-foreground)]">
                      {item.a}
                    </p>
                  </details>
                ))}
              </div>
            </Reveal>
          </div>
        </section>
      ) : null}

      {/* 14 — the close. One action, nothing new. */}
      <section className="mx-auto w-full max-w-6xl px-6 py-24 sm:py-28">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <h2
              data-reveal
              className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
            >
              {m.closeTitle}
            </h2>
            <p
              data-reveal
              className="mt-5 text-lg leading-relaxed text-pretty text-[var(--color-muted-foreground)]"
            >
              {m.closeBody}
            </p>
            <div data-reveal className="mt-9">
              <a
                href={signupUrl}
                className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[var(--color-primary)] px-7 text-base font-medium text-[var(--color-primary-foreground)] shadow-e2 transition-transform hover:-translate-y-0.5"
              >
                {ctaLabel}
              </a>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}

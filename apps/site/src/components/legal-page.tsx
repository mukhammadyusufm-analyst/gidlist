import type { LegalDoc } from '@/lib/legal';

/**
 * The shared shell for the privacy policy and the terms.
 *
 * One component for both because they are the same object rendered twice, and a
 * legal page that drifts typographically from its sibling looks like one of them
 * was an afterthought.
 *
 * Narrow measure and generous leading on purpose. These are the two pages on the
 * site that somebody may actually have to read carefully rather than skim, and
 * the usual marketing width is too wide to read a paragraph of obligations in.
 */
export function LegalPage({ doc }: { doc: LegalDoc }) {
  return (
    <article className="mx-auto w-full max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{doc.title}</h1>
      <p className="mt-3 text-sm text-[var(--color-muted-foreground)]">{doc.updated}</p>

      <div className="mt-8 flex flex-col gap-4">
        {doc.intro.map((paragraph) => (
          <p key={paragraph} className="leading-relaxed">
            {paragraph}
          </p>
        ))}
      </div>

      {doc.sections.map((section) => (
        <section key={section.heading} className="mt-12">
          <h2 className="text-xl font-semibold tracking-tight">{section.heading}</h2>
          <div className="mt-4 flex flex-col gap-4">
            {section.body.map((paragraph) => (
              <p key={paragraph} className="leading-relaxed text-[var(--color-muted-foreground)]">
                {paragraph}
              </p>
            ))}
          </div>
        </section>
      ))}
    </article>
  );
}

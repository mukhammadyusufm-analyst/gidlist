import type { SiteMessages } from '@app/core';

import type { ModuleCopy } from '@/lib/narrative-copy';
import { Reveal } from '@/components/reveal';
import { HierarchyExplorer } from '@/components/demo/hierarchy-explorer';
import { EnforcementSandbox } from '@/components/demo/enforcement-sandbox';
import { ScheduleBuilder } from '@/components/demo/schedule-builder';
import { PeoplePanel } from '@/components/demo/people-panel';
import { Insights } from '@/components/demo/insights';
import { SpaceContents } from '@/components/demo/space-contents';

/**
 * Scenes 4 to 9: one capability each, every one of them hands-on.
 *
 * WHERE THE WORDS COME FROM. Every heading, lead paragraph and caption here is
 * read from `m`, the site message catalogue, which is what the admin screen
 * edits — so the page and the CMS cannot drift apart. Only the *control* labels
 * stay in code (`labels`): the text on a button, the name of a weekday, the word
 * "required" on a chip. Those are interface rather than content, they are wired
 * into the logic beside them, and an administrator renaming Submit to something
 * longer should not be able to break a layout they cannot see.
 *
 * The composition alternates sides so scrolling has a rhythm rather than six
 * identical rows, and the two scenes that are turns in the argument — proof, and
 * the payoff — take the full width instead.
 */

function SceneHeader({
  eyebrow,
  title,
  body,
  centred = false,
}: {
  eyebrow: string;
  title: string;
  body: string;
  centred?: boolean;
}) {
  return (
    <div className={centred ? 'mx-auto max-w-2xl text-center' : 'max-w-xl'}>
      <p
        data-reveal
        className="font-mono text-xs tracking-[0.09em] text-[var(--color-primary)] uppercase"
      >
        {eyebrow}
      </p>
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

function Split({
  children,
  flip = false,
}: {
  children: [React.ReactNode, React.ReactNode];
  flip?: boolean;
}) {
  const [text, scene] = children;
  return (
    <Reveal className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
      <div className={flip ? 'min-w-0 lg:order-2' : 'min-w-0'}>{text}</div>
      <div className={flip ? 'min-w-0 lg:order-1' : 'min-w-0'}>{scene}</div>
    </Reveal>
  );
}

export function Scenes({ m, labels }: { m: SiteMessages; labels: ModuleCopy }) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-28 px-6 py-24 sm:gap-36 sm:py-28">
      {/* 04 — the container everything lives in */}
      <Split>
        <SceneHeader eyebrow={m.spacesEyebrow} title={m.spacesTitle} body={m.spacesLead} />
        <SpaceContents />
      </Split>

      {/* 05 — depth, opened by hand */}
      <Split flip>
        <SceneHeader eyebrow={m.depthEyebrow} title={m.depthTitle} body={m.depthLead} />
        <HierarchyExplorer
          labels={{
            depth: labels.depth.depth,
            maxDepth: m.depthNote,
            expanded: labels.depth.expanded,
          }}
        />
      </Split>

      {/* 06 — the turn. Full width, because this is the scene that has to land. */}
      <Reveal>
        <SceneHeader eyebrow={m.proofEyebrow} title={m.proofTitle} body={m.proofLead} centred />
        <div className="mx-auto mt-12 max-w-3xl">
          <EnforcementSandbox labels={labels.enforce} />
        </div>
      </Reveal>

      {/* 07 — when, and how often */}
      <Split>
        <SceneHeader eyebrow={m.rhythmEyebrow} title={m.rhythmTitle} body={m.rhythmLead} />
        <ScheduleBuilder labels={labels.when} />
      </Split>

      {/* 08 — who, and what they say back */}
      <Split flip>
        <SceneHeader eyebrow={m.peopleEyebrow} title={m.peopleTitle} body={m.peopleLead} />
        <PeoplePanel labels={labels.people} />
      </Split>

      {/* 09 — the payoff, counted from what the visitor actually did */}
      <Reveal stagger={0.05}>
        <SceneHeader
          eyebrow={m.insightsEyebrow}
          title={m.insightsTitle}
          body={m.insightsLead}
          centred
        />
        <div className="mx-auto mt-12 max-w-3xl">
          <Insights
            labels={{
              chart: labels.insights.chart,
              weekdays: labels.insights.weekdays,
              today: labels.insights.today,
              onTime: labels.insights.onTime,
              missed: labels.insights.missed,
              open: labels.insights.open,
              compliance: labels.insights.compliance,
              insight: labels.insights.insight,
              fromYourTicks: m.insightsCaption,
            }}
          />
        </div>
      </Reveal>
    </div>
  );
}

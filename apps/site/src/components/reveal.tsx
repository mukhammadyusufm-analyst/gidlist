'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { gsap } from 'gsap';

/**
 * Reveal a section's marked children once, when it comes into view.
 *
 * One hook for every beat in the capability story, rather than a bespoke
 * timeline each. The beats say different things but move the same way, and a
 * page where each section invents its own motion reads as five designs stapled
 * together.
 *
 * WHAT IT GUARANTEES. Content never depends on the animation running. Elements
 * are hidden by this component at runtime, not in the markup, so with no
 * JavaScript — or an old browser without IntersectionObserver — the section
 * renders finished and readable. That is the failure this is built around:
 * markup that starts at `opacity: 0` and waits for a trigger is markup that can
 * be permanently invisible.
 *
 * Reduced motion is the finished state immediately, not a slower version of the
 * same movement.
 */
export function Reveal({
  children,
  className,
  /** Seconds between each child. Longer where the order carries meaning. */
  stagger = 0.08,
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
}) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = root.current;
    if (!node) return;

    const targets = node.querySelectorAll<HTMLElement>('[data-reveal]');
    if (targets.length === 0) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let observer: IntersectionObserver | undefined;

    const ctx = gsap.context(() => {
      gsap.set(targets, { opacity: 0, y: 16 });

      const tl = gsap.timeline({ paused: true });
      tl.to(targets, { opacity: 1, y: 0, stagger, duration: 0.5, ease: 'power2.out' });

      // Where the API is missing, show the finished state rather than nothing.
      if (typeof IntersectionObserver === 'undefined') {
        tl.progress(1);
        return;
      }

      observer = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          tl.play();
          observer?.disconnect();
        },
        { threshold: 0.2 },
      );
      observer.observe(node);
    }, node);

    return () => {
      observer?.disconnect();
      ctx.revert();
    };
  }, [stagger]);

  return (
    <div ref={root} className={className}>
      {children}
    </div>
  );
}

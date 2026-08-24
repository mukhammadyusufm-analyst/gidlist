import { avatarInitials, generatedAvatar } from '@app/core';

import { cn } from '@/lib/utils';

/**
 * A square image, or a generated one when there is no upload.
 *
 * The generated form is a coloured tile with initials, as most platforms do —
 * it makes a list scannable straight away instead of showing a wall of grey
 * placeholders that all look alike.
 *
 * `seed` should be the row's id, never its name: seeding from the name would
 * change the colour whenever something is renamed, quietly breaking the visual
 * memory people build up for the things they use daily.
 *
 * Deliberately a plain <img> for uploads rather than next/image. SVG is an
 * allowed logo format, and next/image only serves SVG with
 * `dangerouslyAllowSVG`, which would let a customer upload an SVG containing
 * script and have it served from our own origin.
 */
export function Avatar({
  name,
  imageUrl,
  seed,
  className,
}: {
  name: string;
  imageUrl: string | null;
  seed: string;
  className?: string;
}) {
  const base = 'flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg';

  if (imageUrl) {
    return (
      <span className={cn(base, 'border border-[var(--color-border)]', className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="" className="size-full object-cover" loading="lazy" />
      </span>
    );
  }

  const { gradient } = generatedAvatar(seed);

  return (
    <span
      // Not aria-hidden: the initials are the only visual identity here, and the
      // name is always adjacent in every place this is used, so it stays
      // decorative rather than announcing a duplicate label.
      aria-hidden="true"
      className={cn(base, 'text-sm font-semibold text-white', className)}
      style={{ backgroundImage: gradient }}
    >
      {avatarInitials(name)}
    </span>
  );
}

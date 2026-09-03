import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { bannerPresetGradient, generatedAvatar, isBannerPreset } from '@app/core/appearance';

import type { Board } from '@/lib/supabase/database.types';
import { Avatar } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';

/**
 * A space, as a card with a banded header.
 *
 * The previous list rendered each space as a single text row, which made the
 * most important object in the product look like a table entry. A card with a
 * colour band, an avatar and its description gives each one a face — which is
 * what makes a list of eight scannable rather than read line by line.
 *
 * Spaces with no banner still get a band, derived from the same seeded colour
 * as their avatar, so the grid never looks half-finished.
 */
export function SpaceCard({ board }: { board: Board }) {
  const presetGradient = bannerPresetGradient(board.banner_url);
  const uploaded = board.banner_url && !isBannerPreset(board.banner_url) ? board.banner_url : null;
  const fallback = generatedAvatar(board.id).gradient;

  return (
    <Card interactive className="group overflow-hidden">
      {/* `outline-none` alone would leave keyboard users with no focus cue at
          all; the ring is inset because the card clips its own overflow. */}
      {/* Straight to /fill, not to the space root that redirects there.
          This is the most-travelled link in the product, and the root's
          redirect costs a whole extra function invocation — measured at
          ~220ms of server rendering per request. The redirect stays for
          bookmarks and typed addresses; it just should not be on the path
          somebody takes twenty times a day. */}
      <Link
        href={`/dashboard/boards/${board.slug}/fill`}
        className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-inset"
      >
        <div
          className="h-20 w-full bg-cover bg-center"
          style={
            uploaded
              ? { backgroundImage: `url(${uploaded})` }
              : { backgroundImage: presetGradient ?? fallback }
          }
          aria-hidden="true"
        />

        <div className="p-4">
          {/* Pulled up over the band so the avatar reads as belonging to this
              space rather than floating in the body text. */}
          <div className="-mt-10 mb-3">
            <Avatar
              name={board.name}
              imageUrl={board.logo_url}
              seed={board.id}
              className="size-12 shadow-e2 ring-4 ring-[var(--color-card)]"
            />
          </div>

          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-semibold">{board.name}</p>
              <p className="mt-0.5 line-clamp-2 text-sm text-[var(--color-muted-foreground)]">
                {board.description || `/${board.slug}`}
              </p>
            </div>

            <ChevronRight
              className="mt-0.5 size-4 shrink-0 text-[var(--color-muted-foreground)] transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </div>
        </div>
      </Link>
    </Card>
  );
}

'use client';

import { FileText, Play } from 'lucide-react';
import { videoThumbnail, type InstructionBlock } from '@app/core';

import { useT } from '@/components/i18n/provider';

/**
 * Instructions as the person filling the checklist in sees them.
 *
 * Files arrive as signed links minted by the page; a path with no link is one
 * this viewer may not read, and is left out rather than rendered as a broken
 * image.
 */
export function InstructionsView({
  blocks,
  urls,
}: {
  blocks: InstructionBlock[];
  urls: Record<string, string>;
}) {
  const { t } = useT();
  if (blocks.length === 0) return null;

  return (
    <div className="space-y-3">
      {blocks.map((block, i) => {
        if (block.type === 'text') {
          return (
            <p key={i} className="text-sm whitespace-pre-wrap">
              {block.text}
            </p>
          );
        }

        if (block.type === 'video') {
          const thumb = videoThumbnail(block.url);
          return (
            <a
              key={i}
              href={block.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] p-2 text-sm hover:bg-[var(--color-accent)]"
            >
              {thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumb} alt="" className="h-16 w-28 rounded object-cover" loading="lazy" />
              ) : (
                <span className="grid h-16 w-28 place-items-center rounded bg-[var(--color-muted)]">
                  <Play className="size-5" aria-hidden="true" />
                </span>
              )}
              <span className="min-w-0 flex-1 truncate">{block.title}</span>
            </a>
          );
        }

        const url = urls[block.path];
        if (!url) return null;

        if (block.type === 'image') {
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={url}
              alt={block.name}
              className="max-h-80 w-full rounded-lg border border-[var(--color-border)] object-contain"
              loading="lazy"
            />
          );
        }

        return (
          <a
            key={i}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] p-2 text-sm hover:bg-[var(--color-accent)]"
          >
            <FileText className="size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{block.name}</span>
            <span className="text-xs text-[var(--color-muted-foreground)]">
              {t('instructions.open')}
            </span>
          </a>
        );
      })}
    </div>
  );
}

'use client';

import { useState, useTransition } from 'react';
import { BANNER_PRESETS, BANNER_PRESET_PREFIX, isBannerPreset } from '@app/core';

import { setBoardBanner, setChecklistBanner } from '@/lib/media/actions';
import { Banner } from '@/components/ui/banner';
import { BannerFramingControl } from '@/components/ui/banner-framing';
import { Button } from '@/components/ui/button';
import { FormNotice } from '@/components/ui/field-error';
import { ImageUploadForm, type UploadTarget } from '@/components/ui/image-upload-form';
import { useT } from '@/components/i18n/provider';
import { cn } from '@/lib/utils';

/**
 * Pick a built-in banner, upload one, or clear it.
 *
 * The presets come first on purpose: most people have no suitable image to
 * hand, and offering only an upload field makes the feature feel like work.
 * Uploading is kept as the second option rather than removed.
 */
export function BannerPicker({
  current,
  target,
  prefix,
}: {
  current: string | null;
  target: UploadTarget;
  prefix: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const { t } = useT();

  const currentPreset = isBannerPreset(current)
    ? current!.slice(BANNER_PRESET_PREFIX.length)
    : null;

  function choose(presetKey: string | null) {
    setError(null);
    startTransition(async () => {
      const result =
        target.kind === 'board'
          ? await setBoardBanner({ boardId: target.boardId, slug: target.slug, presetKey })
          : await setChecklistBanner({ checklistId: target.checklistId, presetKey });

      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="space-y-4">
      {error ? <FormNotice kind="error">{error}</FormNotice> : null}

      {/* An uploaded image gets the framing control instead of a plain preview:
          it renders the same 3:1 strip, so showing both would be the same
          picture twice. A preset is a gradient with nothing to frame. */}
      {current && !isBannerPreset(current) ? (
        <BannerFramingControl current={current} target={target} />
      ) : current ? (
        <Banner value={current} alt="Current banner" />
      ) : (
        <p className="text-sm text-[var(--color-muted-foreground)]">{t('space.noBanner')}</p>
      )}

      <div>
        <p className="mb-2 text-sm font-medium">{t('space.chooseOne')}</p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {BANNER_PRESETS.map((preset) => {
            const selected = currentPreset === preset.key;
            return (
              <button
                key={preset.key}
                type="button"
                disabled={pending}
                onClick={() => choose(preset.key)}
                aria-pressed={selected}
                title={preset.label}
                className={cn(
                  'aspect-[3/1] rounded-md border-2 transition-opacity disabled:opacity-50',
                  // Selection is shown by a ring, not by colour alone — the
                  // swatches are all colours, so a colour cue would be invisible.
                  selected
                    ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-ring)] ring-offset-2 ring-offset-[var(--color-background)]'
                    : 'border-transparent hover:opacity-80',
                )}
                style={{ backgroundImage: preset.gradient }}
              >
                <span className="sr-only">
                  {preset.label}
                  {selected ? ' (selected)' : ''}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowUpload((v) => !v)}
        >
          {showUpload ? t('media.cancelUpload') : t('space.uploadYourOwn')}
        </Button>

        {current ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => choose(null)}
          >
            {t('space.removeBanner')}
          </Button>
        ) : null}
      </div>

      {showUpload ? (
        <div className="rounded-xl border border-[var(--color-border)] p-4">
          <ImageUploadForm
            bucket={target.kind === 'board' ? 'board-banners' : 'checklist-banners'}
            target={target}
            prefix={prefix}
            label={t('media.uploadBanner')}
          />
        </div>
      ) : null}
    </div>
  );
}

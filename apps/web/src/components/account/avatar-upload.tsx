'use client';

import { useRef, useState, useTransition } from 'react';
import { MEDIA_LIMITS, buildMediaPath, validateMediaFile } from '@app/core/media';

import { createClient } from '@/lib/supabase/client';
import { removeAvatar, saveAvatar } from '@/lib/account/actions';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { FormNotice } from '@/components/ui/field-error';
import { useT } from '@/components/i18n/provider';

/**
 * Personal photo.
 *
 * Separate from the board media uploader because the authorisation question is
 * different: board images are keyed by board id and checked against admin
 * rights, whereas this is keyed by the person's own user id. Sharing one
 * component would have meant one of the two rules pretending to be the other.
 *
 * As elsewhere, the file goes browser → Supabase Storage directly. Server
 * Actions cap request bodies at 1 MB, and proxying an image through the server
 * doubles the transfer for someone on mobile data.
 */
export function AvatarUpload({
  userId,
  name,
  currentUrl,
}: {
  userId: string;
  name: string;
  currentUrl: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { t } = useT();

  const limits = MEDIA_LIMITS['user-avatars'];

  function upload(file: File) {
    setError(null);

    const problem = validateMediaFile('user-avatars', file);
    if (problem) {
      setError(t(problem.key, problem.values));
      return;
    }

    startTransition(async () => {
      const supabase = createClient();
      // The user id must be the first path segment — the storage policy reads
      // it to decide whether this write is allowed.
      const path = buildMediaPath(userId, 'avatar', file.name);

      const { error: uploadError } = await supabase.storage
        .from('user-avatars')
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) {
        setError(uploadError.message);
        return;
      }

      const result = await saveAvatar(path);
      if (result.error) setError(result.error);
      if (inputRef.current) inputRef.current.value = '';
    });
  }

  return (
    <div className="space-y-3">
      {error ? <FormNotice kind="error">{error}</FormNotice> : null}

      <div className="flex items-center gap-4">
        <Avatar name={name} imageUrl={currentUrl} seed={userId} className="size-16" />

        <div className="min-w-0">
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {currentUrl ? t('account.photoIntro') : t('account.generatedPhoto')}
          </p>

          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => inputRef.current?.click()}
            >
              {pending ? t('common.uploading') : t('media.uploadImage')}
            </Button>

            {currentUrl ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => startTransition(async () => void (await removeAvatar()))}
              >
                {t('account.removePhoto')}
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Hidden, driven by the button above: the native file input cannot be
          styled to match, and a bare one beside styled buttons looks broken. */}
      <input
        ref={inputRef}
        type="file"
        accept={limits.accept}
        className="sr-only"
        aria-label={t('account.photo')}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
        }}
      />
    </div>
  );
}

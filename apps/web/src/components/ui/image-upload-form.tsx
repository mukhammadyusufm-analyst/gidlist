'use client';

import { useRef, useState, useTransition } from 'react';
import {
  MEDIA_LIMITS,
  buildMediaPath,
  validateMediaFile,
  type MediaBucket,
} from '@app/core/media';

import { createClient } from '@/lib/supabase/client';
import { saveBoardMedia, saveChecklistMedia } from '@/lib/media/actions';
import { Button } from '@/components/ui/button';
import { FormNotice } from '@/components/ui/field-error';
import { useT } from '@/components/i18n/provider';

/**
 * Uploads an image straight from the browser to Supabase Storage, then asks the
 * server to record the resulting path.
 *
 * The file deliberately does not pass through Next.js. Server Actions cap
 * request bodies at 1 MB, and even with that raised, routing a 5 MB banner
 * through the server would double the transfer for someone on mobile data.
 * Permission is unaffected: the storage policy checks board membership on the
 * upload itself, so the browser cannot write anywhere it should not.
 */
/**
 * Which row the uploaded image belongs to.
 *
 * A discriminated object rather than a callback prop: a Server Component
 * cannot hand a plain function to a Client Component, and wrapping each call
 * site in its own bound server action would be four more moving parts for no
 * gain. The form picks the right action from `kind`.
 */
export type UploadTarget =
  | { kind: 'board'; boardId: string; slug: string }
  | { kind: 'checklist'; boardId: string; checklistId: string };

export function ImageUploadForm({
  bucket,
  target,
  prefix,
  label = 'Upload',
}: {
  bucket: MediaBucket;
  target: UploadTarget;
  prefix: string;
  label?: string;
}) {
  const boardId = target.boardId;
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { t } = useT();

  const limits = MEDIA_LIMITS[bucket];

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    const file = inputRef.current?.files?.[0];
    if (!file) {
      setError(t('media.chooseFirst'));
      return;
    }

    // Checked here so a too-large file is rejected instantly rather than after
    // a slow upload. The bucket enforces the same limits regardless.
    const problem = validateMediaFile(bucket, file);
    if (problem) {
      setError(problem);
      return;
    }

    startTransition(async () => {
      const supabase = createClient();
      const path = buildMediaPath(boardId, prefix, file.name);

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) {
        // A permission failure here means the storage policy refused — which is
        // the same rule the server would apply, just reported earlier.
        setError(`Upload failed: ${uploadError.message}`);
        return;
      }

      const result =
        target.kind === 'board'
          ? await saveBoardMedia({ bucket, boardId, slug: target.slug, path })
          : await saveChecklistMedia({
              bucket,
              boardId,
              checklistId: target.checklistId,
              path,
            });

      if (result.error) {
        setError(result.error);
        return;
      }

      if (inputRef.current) inputRef.current.value = '';
      setNotice(t('media.updated'));
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error ? <FormNotice kind="error">{error}</FormNotice> : null}
      {notice ? <FormNotice kind="info">{notice}</FormNotice> : null}

      <div>
        <input
          ref={inputRef}
          type="file"
          name="image"
          required
          accept={limits.accept}
          aria-label={label}
          className="block w-full text-sm file:mr-3 file:min-h-11 file:rounded-md file:border-0 file:bg-[var(--color-secondary)] file:px-4 file:py-2 file:text-sm file:font-medium hover:file:opacity-80"
        />
        <p className="mt-1.5 text-xs text-[var(--color-muted-foreground)]">{limits.hint}</p>
      </div>

      <Button type="submit" size="full" disabled={pending} aria-busy={pending}>
        {pending ? t('common.uploading') : label}
      </Button>
    </form>
  );
}

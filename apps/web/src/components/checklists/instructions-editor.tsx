'use client';

import { useRef, useState, useTransition } from 'react';
import { Trash2 } from 'lucide-react';
import {
  INSTRUCTION_BLOCKS_MAX,
  buildMediaPath,
  parseInstructions,
  validateMediaFile,
  type InstructionBlock,
} from '@app/core';

import { createClient } from '@/lib/supabase/client';
import { saveInstructions } from '@/lib/checklists/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormNotice } from '@/components/ui/field-error';
import { InstructionsView } from '@/components/checklists/instructions-view';
import { useT } from '@/components/i18n/provider';

const BUCKET = 'checklist-instructions' as const;

/**
 * Writing the instructions for a checklist or one of its items.
 *
 * Files go browser → storage directly, like every other upload here; only the
 * path is sent to the server. Video is a link: the bucket cannot hold video and
 * hosting it is a bill, not a feature.
 *
 * Saving writes the whole list, so removing a block is the same operation as
 * adding one — no per-block endpoints.
 */
export function InstructionsEditor({
  scope,
  id,
  checklistId,
  boardId,
  initial,
  urls,
}: {
  scope: 'item' | 'version';
  id: string;
  checklistId: string;
  boardId: string;
  initial: InstructionBlock[];
  urls: Record<string, string>;
}) {
  const { t } = useT();
  const [blocks, setBlocks] = useState<InstructionBlock[]>(initial);
  const [previewUrls, setPreviewUrls] = useState(urls);
  const [text, setText] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const full = blocks.length >= INSTRUCTION_BLOCKS_MAX;

  function persist(next: InstructionBlock[]) {
    setBlocks(next);
    setSaved(false);
    startTransition(async () => {
      const result = await saveInstructions({ scope, id, checklistId, blocks: next });
      if (result.error) setError(result.error);
      else setSaved(true);
    });
  }

  function addText() {
    const value = text.trim();
    if (!value) return;
    setText('');
    persist([...blocks, { type: 'text', text: value }]);
  }

  function addVideo() {
    const url = videoUrl.trim();
    if (!/^https?:\/\//i.test(url)) {
      setError(t('instructions.videoUrlInvalid'));
      return;
    }
    setVideoUrl('');
    persist([...blocks, { type: 'video', url, title: url }]);
  }

  function addFile() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    const problem = validateMediaFile(BUCKET, file);
    if (problem) {
      setError(t(problem.key, problem.values));
      return;
    }

    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      // <board>/<checklist>/… — the second segment is what the storage policy
      // reads to decide who may open the file.
      const path = buildMediaPath(boardId, `${checklistId}/instruction`, file.name);

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) {
        setError(t('media.uploadFailed', { message: uploadError.message }));
        return;
      }

      const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
      if (signed?.signedUrl) setPreviewUrls((u) => ({ ...u, [path]: signed.signedUrl }));

      if (fileRef.current) fileRef.current.value = '';
      persist([
        ...blocks,
        {
          type: file.type === 'application/pdf' ? 'file' : 'image',
          path,
          name: file.name,
        },
      ]);
    });
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {parseInstructions(blocks).map((block, i) => (
          <li key={i} className="flex items-start gap-2 rounded-lg border border-[var(--color-border)] p-2">
            <div className="min-w-0 flex-1">
              <InstructionsView blocks={[block]} urls={previewUrls} />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={t('common.delete')}
              disabled={pending}
              onClick={() => persist(blocks.filter((_, j) => j !== i))}
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </Button>
          </li>
        ))}
      </ul>

      {full ? (
        <FormNotice kind="info">{t('instructions.full', { n: INSTRUCTION_BLOCKS_MAX })}</FormNotice>
      ) : (
        // Each control and its button stack on a phone: side by side they left
        // the field about half a word wide.
        <div className="space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={2}
              placeholder={t('instructions.textPlaceholder')}
              aria-label={t('instructions.textPlaceholder')}
              className="w-full rounded-md border border-[var(--color-input)] bg-[var(--color-background)] px-3 py-2 text-sm"
            />
            <Button
              type="button"
              size="sm"
              className="sm:shrink-0"
              disabled={pending}
              onClick={addText}
            >
              {t('instructions.addText')}
            </Button>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder={t('instructions.videoPlaceholder')}
              aria-label={t('instructions.videoPlaceholder')}
              inputMode="url"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="sm:shrink-0"
              disabled={pending}
              onClick={addVideo}
            >
              {t('instructions.addVideo')}
            </Button>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              aria-label={t('instructions.addFile')}
              className="block w-full text-sm file:mr-3 file:min-h-9 file:rounded-md file:border-0 file:bg-[var(--color-secondary)] file:px-3 file:py-1.5 file:text-sm"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="sm:shrink-0"
              disabled={pending}
              onClick={addFile}
            >
              {t('instructions.addFile')}
            </Button>
          </div>
        </div>
      )}

      {error ? <FormNotice kind="error">{error}</FormNotice> : null}
      {saved && !pending ? (
        <p className="text-xs text-[var(--color-muted-foreground)]">{t('common.saved')}</p>
      ) : null}
    </div>
  );
}

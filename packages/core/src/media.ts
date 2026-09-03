/**
 * Image upload rules, shared by the browser and the server.
 *
 * The browser uses these to reject a bad file before wasting an upload; the
 * server uses the same values to re-check what it is asked to save; and the
 * storage buckets enforce them a third time. Three checks, one source of truth,
 * so they cannot drift apart.
 */

export const MEDIA_BUCKETS = [
  'board-logos',
  'board-banners',
  'checklist-banners',
  'checklist-avatars',
  // Keyed by user id rather than board id, and authorised against the caller's
  // own account — see the migration. It shares these limits but not the rule.
  'user-avatars',
] as const;

export type MediaBucket = (typeof MEDIA_BUCKETS)[number];

/**
 * `hintKey` rather than a hint, because this file is read in three languages.
 *
 * An English sentence here would have been rendered verbatim under every upload
 * field regardless of the language the app was being read in — which is what it
 * did. The catalogue owns the wording and takes `{mb}`; this owns the rule.
 */
export const MEDIA_LIMITS: Record<
  MediaBucket,
  { maxBytes: number; types: readonly string[]; accept: string; hintKey: string }
> = {
  'board-logos': {
    maxBytes: 2 * 1024 * 1024,
    types: ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'],
    accept: 'image/png,image/jpeg,image/webp,image/svg+xml',
    hintKey: 'media.hintLogo',
  },
  'board-banners': {
    maxBytes: 5 * 1024 * 1024,
    types: ['image/png', 'image/jpeg', 'image/webp'],
    accept: 'image/png,image/jpeg,image/webp',
    hintKey: 'media.hintBanner',
  },
  'checklist-banners': {
    maxBytes: 5 * 1024 * 1024,
    types: ['image/png', 'image/jpeg', 'image/webp'],
    accept: 'image/png,image/jpeg,image/webp',
    hintKey: 'media.hintBanner',
  },
  'checklist-avatars': {
    maxBytes: 2 * 1024 * 1024,
    types: ['image/png', 'image/jpeg', 'image/webp'],
    accept: 'image/png,image/jpeg,image/webp',
    hintKey: 'media.hintSquare',
  },
  'user-avatars': {
    maxBytes: 2 * 1024 * 1024,
    types: ['image/png', 'image/jpeg', 'image/webp'],
    accept: 'image/png,image/jpeg,image/webp',
    hintKey: 'media.hintSquare',
  },
};

/** Whole megabytes, for the wording that quotes the ceiling. */
export function mediaLimitMb(bucket: MediaBucket): number {
  return Math.round(MEDIA_LIMITS[bucket].maxBytes / (1024 * 1024));
}

export function isMediaBucket(value: string): value is MediaBucket {
  return (MEDIA_BUCKETS as readonly string[]).includes(value);
}

/** Human-readable form of a bucket's accepted types, for error messages. */
export function describeTypes(bucket: MediaBucket): string {
  return MEDIA_LIMITS[bucket].types
    .map((t) => t.replace('image/', '').replace('svg+xml', 'SVG').toUpperCase())
    .join(', ');
}

/**
 * What is wrong with a chosen file, as a catalogue key and its values.
 *
 * A message rather than a code was the earlier shape, and it meant the one
 * place a person is told why their photograph was refused answered in English
 * whatever language they were working in. Returning the key leaves the wording
 * to whoever is displaying it — which is always a component with `t` to hand,
 * since nothing on the server calls this.
 */
export type MediaProblem = { key: string; values?: Record<string, string | number> };

export function validateMediaFile(
  bucket: MediaBucket,
  file: { size: number; type: string },
): MediaProblem | null {
  const limits = MEDIA_LIMITS[bucket];

  if (file.size === 0) return { key: 'media.errEmpty' };
  if (file.size > limits.maxBytes) {
    return { key: 'media.errTooLarge', values: { mb: mediaLimitMb(bucket) } };
  }
  if (!limits.types.includes(file.type)) {
    return { key: 'media.errWrongType', values: { types: describeTypes(bucket) } };
  }
  return null;
}

/**
 * Where a file lives inside its bucket.
 *
 * The owner id MUST be the first path segment — a board id for board media, a
 * user id for personal avatars — because the storage policy reads exactly that
 * segment to decide whether the caller may write. The timestamp defeats CDN
 * caching of a replaced image, which would otherwise keep showing the old one
 * for hours.
 */
export function buildMediaPath(ownerId: string, prefix: string, fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
  return `${ownerId}/${prefix}-${Date.now()}.${extension}`;
}

/**
 * Confirm a storage path belongs to the board it claims to.
 *
 * Checked again on the server before the URL is written to a row: without it,
 * a crafted request could point a board's logo at any file in the bucket,
 * including another customer's.
 */
export function pathBelongsToBoard(path: string, boardId: string): boolean {
  return path.startsWith(`${boardId}/`) && !path.includes('..');
}

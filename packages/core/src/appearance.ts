/**
 * Built-in banners and generated avatars.
 *
 * Two problems this solves: most people have no suitable banner image to hand,
 * and a wall of grey placeholder squares makes a list of checklists hard to
 * scan. Both are fixed without anyone uploading anything.
 *
 * Presets are gradients rather than bundled photographs — deliberately. Stock
 * photos carry licensing obligations and megabytes of assets to ship and serve;
 * a gradient is a few bytes of CSS, renders at any size without artefacts, and
 * needs no storage bucket, no CDN and no upload.
 */

/**
 * A preset is stored in the same column as an uploaded banner's URL, marked by
 * this prefix. Keeping one column avoids a second "banner_type" field that
 * could contradict it — a row cannot be both a preset and an upload.
 */
export const BANNER_PRESET_PREFIX = 'preset:';

export type BannerPreset = {
  key: string;
  label: string;
  /** CSS gradient, used directly as a background-image value. */
  gradient: string;
};

export const BANNER_PRESETS: BannerPreset[] = [
  { key: 'dawn', label: 'Dawn', gradient: 'linear-gradient(120deg, #ff9a6b 0%, #ff6b95 55%, #b14ac0 100%)' },
  { key: 'harbour', label: 'Harbour', gradient: 'linear-gradient(120deg, #2a78d6 0%, #1baf7a 100%)' },
  { key: 'dusk', label: 'Dusk', gradient: 'linear-gradient(120deg, #4a3aa7 0%, #9085e9 50%, #e87ba4 100%)' },
  { key: 'moss', label: 'Moss', gradient: 'linear-gradient(120deg, #157a55 0%, #6ab04c 100%)' },
  { key: 'ember', label: 'Ember', gradient: 'linear-gradient(120deg, #d03b3b 0%, #eda100 100%)' },
  { key: 'slate', label: 'Slate', gradient: 'linear-gradient(120deg, #3b4252 0%, #6b7a90 100%)' },
  { key: 'tide', label: 'Tide', gradient: 'linear-gradient(120deg, #0f5c7a 0%, #1baf7a 60%, #86e3c8 100%)' },
  { key: 'plum', label: 'Plum', gradient: 'linear-gradient(120deg, #5a1f4a 0%, #a83a63 100%)' },
  { key: 'sand', label: 'Sand', gradient: 'linear-gradient(120deg, #c98500 0%, #f0d9a8 100%)' },
  { key: 'steel', label: 'Steel', gradient: 'linear-gradient(120deg, #1c5cab 0%, #5598e7 100%)' },
  { key: 'forest', label: 'Forest', gradient: 'linear-gradient(120deg, #14342b 0%, #2f6b2f 60%, #8fbf6a 100%)' },
  { key: 'rose', label: 'Rose', gradient: 'linear-gradient(120deg, #b5471f 0%, #e87ba4 100%)' },
];

export function isBannerPreset(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(BANNER_PRESET_PREFIX);
}

export function bannerPresetValue(key: string): string {
  return `${BANNER_PRESET_PREFIX}${key}`;
}

/** The gradient for a stored value, or null if it is an upload or absent. */
export function bannerPresetGradient(value: string | null | undefined): string | null {
  if (!isBannerPreset(value)) return null;
  const key = (value as string).slice(BANNER_PRESET_PREFIX.length);
  return BANNER_PRESETS.find((p) => p.key === key)?.gradient ?? null;
}

export function isKnownBannerPreset(key: string): boolean {
  return BANNER_PRESETS.some((p) => p.key === key);
}

/**
 * How an uploaded banner is fitted into the 3:1 strip.
 *
 * `cover` fills the strip and crops what does not fit — right for a photograph.
 * `contain` shows the whole image and pads the sides — right for a wide logo or
 * a graphic with text, where cropping destroys the point of the image.
 */
export type BannerFit = 'cover' | 'contain';

export type BannerFraming = {
  fit: BannerFit;
  /** Percentages, 0–100. Which part of the image stays visible under `cover`. */
  focusX: number;
  focusY: number;
};

export const DEFAULT_BANNER_FRAMING: BannerFraming = { fit: 'cover', focusX: 50, focusY: 50 };

/**
 * Framing lives in the stored URL's fragment, not in its own columns.
 *
 * The alternative was three columns on each of `boards` and `checklists`. This
 * is better for one reason that outweighs the tidiness of a proper column: the
 * framing describes *one specific image*, and a fragment cannot survive that
 * image being replaced. Separate columns would keep a focal point tuned for the
 * old photograph and silently apply it to the new one — a bug nobody would
 * report, because the banner would merely look slightly wrong.
 *
 * It is also invisible to everything else. A fragment is never sent to the
 * server when a browser fetches the image, and nothing in this codebase parses
 * `banner_url` back into a storage path, so appending one is inert.
 *
 * The cost is honest: this cannot be queried in SQL, and anyone reading the
 * column sees a URL with something odd on the end. That is acceptable for a
 * presentational hint and would not be for anything a report reads.
 */
const FRAMING_FRAGMENT = 'gidlist-framing';

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 50;
  return Math.min(100, Math.max(0, Math.round(value)));
}

/** Split a stored banner value into the image URL and how it should be framed. */
export function parseBannerValue(value: string): { src: string; framing: BannerFraming } {
  const marker = value.indexOf(`#${FRAMING_FRAGMENT}=`);
  if (marker === -1) return { src: value, framing: DEFAULT_BANNER_FRAMING };

  const src = value.slice(0, marker);
  const encoded = value.slice(marker + FRAMING_FRAGMENT.length + 2);
  const [fit, x, y] = encoded.split(',');

  return {
    src,
    framing: {
      // Anything unrecognised falls back rather than throwing. This string can
      // be hand-edited in the database, and a bad value should cost a default
      // crop, not a page that will not render.
      fit: fit === 'contain' ? 'contain' : 'cover',
      focusX: clampPercent(Number(x)),
      focusY: clampPercent(Number(y)),
    },
  };
}

/** Attach framing to an image URL, replacing any already there. */
export function withBannerFraming(value: string, framing: BannerFraming): string {
  const { src } = parseBannerValue(value);
  const { fit, focusX, focusY } = framing;

  // The default is stored as a bare URL. Every banner uploaded before this
  // existed is already in that form, so writing nothing keeps the two identical
  // rather than creating two spellings of the same thing.
  if (fit === 'cover' && focusX === 50 && focusY === 50) return src;

  return `${src}#${FRAMING_FRAGMENT}=${fit},${clampPercent(focusX)},${clampPercent(focusY)}`;
}

// -----------------------------------------------------------------------------
// Generated avatars
// -----------------------------------------------------------------------------

/**
 * Background colours for generated avatars.
 *
 * Every one is dark enough to carry white initials at 4.5:1 or better. That is
 * the whole constraint — these are decorative and identity comes from the text
 * on top, so unlike a chart palette they do not need to be distinguishable from
 * one another under colour-vision deficiency.
 */
const AVATAR_COLORS = [
  '#1c5cab',
  '#b5471f',
  '#157a55',
  '#8a5a00',
  '#a83a63',
  '#2f6b2f',
  '#4a3aa7',
  '#a32c2c',
  '#1d6b6b',
  '#5a3a8a',
] as const;

/**
 * FNV-1a. Chosen because it is short, has no dependencies, and — the part that
 * matters — is deterministic across platforms, so a board shows the same colour
 * on the web app and in the mobile app rather than changing as you switch.
 */
function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * A stable colour pair for a seed — pass the row's id, not its name, so
 * renaming something does not change its colour and quietly break the visual
 * memory people build up.
 */
export function generatedAvatar(seed: string): { background: string; gradient: string } {
  const base = AVATAR_COLORS[hashString(seed) % AVATAR_COLORS.length];
  return {
    background: base,
    // A second stop, angled, so the mark reads as deliberate rather than as an
    // un-loaded image.
    gradient: `linear-gradient(135deg, ${base} 0%, ${base}cc 100%)`,
  };
}

export function avatarInitials(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
  return letters || '?';
}

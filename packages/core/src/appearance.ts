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

/**
 * Interface theme.
 *
 * Stored per device, not per account — unlike language. Which theme is right
 * depends on where someone is standing: a phone held under bright shopfloor
 * lighting wants the light theme, the same person's desktop in a dim office at
 * six in the evening wants dark. Syncing it to the profile would mean fixing
 * one and breaking the other.
 */

export const THEMES = ['light', 'dark', 'system'] as const;
export type Theme = (typeof THEMES)[number];

export const DEFAULT_THEME: Theme = 'system';

export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value);
}

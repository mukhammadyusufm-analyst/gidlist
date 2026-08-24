import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind classes, letting later ones win.
 *
 * Plain string concatenation leaves both `p-2` and `p-4` in the class list and
 * the winner depends on stylesheet order, not call order — so a component's
 * override silently fails. `twMerge` resolves the conflict properly.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

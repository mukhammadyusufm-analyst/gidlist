import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge class names, letting a later utility beat an earlier one.
 *
 * The same helper the product has in `lib/utils.ts`. Not shared through
 * `packages/design`, because that package is deliberately CSS and tokens only —
 * pulling a JS dependency into it would make every consumer take clsx and
 * tailwind-merge whether or not they use them.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

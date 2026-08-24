import type { Messages } from '@app/core';

import { en } from '@/messages/en';
import { ru } from '@/messages/ru';
import { uz } from '@/messages/uz';

/**
 * The catalogue that ships in the bundle.
 *
 * Only the built-in languages appear here. Languages added by an administrator
 * have no bundled entry and are served from English plus their database
 * overrides — which is what lets a new language be added without a deploy.
 *
 * Imported statically rather than on demand: all three together are a few
 * kilobytes, and a dynamic import would add an await to every page render to
 * save less than one image.
 */
export const CATALOGUE: Partial<Record<string, Messages>> = { en, ru, uz };

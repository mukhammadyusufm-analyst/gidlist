/**
 * Instructions on a checklist or one of its items (README item 57).
 *
 * An ordered list of blocks, stored as JSON on the version and on each item —
 * see `20260919090000_instructions.sql` for why there and not in a table.
 * Video is a link, never an upload.
 */

export type InstructionBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; path: string; name: string }
  | { type: 'file'; path: string; name: string }
  | { type: 'video'; url: string; title: string };

/** Longest a single text block may be, so one block cannot become a manual. */
export const INSTRUCTION_TEXT_MAX = 2000;
export const INSTRUCTION_BLOCKS_MAX = 20;

/**
 * Read whatever is in the column, keeping only blocks that make sense.
 *
 * Defensive rather than validating: the column is JSON, and a row written by an
 * older build, a migration, or a future block type must never break the page
 * somebody is filling in. Anything unrecognised is dropped.
 */
export function parseInstructions(value: unknown): InstructionBlock[] {
  if (!Array.isArray(value)) return [];

  const blocks: InstructionBlock[] = [];
  for (const raw of value.slice(0, INSTRUCTION_BLOCKS_MAX)) {
    if (!raw || typeof raw !== 'object') continue;
    const b = raw as Record<string, unknown>;
    const str = (key: string) => (typeof b[key] === 'string' ? (b[key] as string).trim() : '');

    if (b.type === 'text' && str('text')) {
      blocks.push({ type: 'text', text: str('text').slice(0, INSTRUCTION_TEXT_MAX) });
    } else if ((b.type === 'image' || b.type === 'file') && str('path')) {
      blocks.push({ type: b.type, path: str('path'), name: str('name') || str('path') });
    } else if (b.type === 'video' && /^https?:\/\//i.test(str('url'))) {
      blocks.push({ type: 'video', url: str('url'), title: str('title') || str('url') });
    }
  }
  return blocks;
}

/**
 * The still image for a video link, or null.
 *
 * YouTube publishes one at a predictable address, which covers the case this
 * was asked for. Anything else gets a link with no picture rather than a
 * server-side fetch of an arbitrary URL, which is a request-forgery hole.
 */
export function videoThumbnail(url: string): string | null {
  const id = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/.exec(url);
  return id ? `https://i.ytimg.com/vi/${id[1]}/mqdefault.jpg` : null;
}

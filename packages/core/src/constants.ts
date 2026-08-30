/**
 * The checklist item tree is capped at 5 levels, as specified.
 *
 * Level 1 is a top-level item inside a group; level 5 is the deepest allowed
 * sub-task. The cap is enforced in three places on purpose: here for the UI,
 * a CHECK constraint in the database, and the insert policy. Depth bugs are
 * hard to unwind once real data exists.
 */
export const MAX_ITEM_DEPTH = 5;

/**
 * Space roles, ordered from most to least privileged.
 *
 * The line that matters is between governance and content: admins manage people
 * and branding, editors build checklists, members fill them in. Someone who
 * writes the checklists for a production line should not thereby be able to
 * invite staff or rebrand the space.
 */
export const BOARD_ROLES = ['owner', 'admin', 'editor', 'member'] as const;
export type BoardRole = (typeof BOARD_ROLES)[number];

/** Roles that may create and edit checklists, schedules and their imagery. */
export const CONTENT_ROLES: readonly BoardRole[] = ['owner', 'admin', 'editor'];

/** Roles that may manage people and space settings. */
export const GOVERNANCE_ROLES: readonly BoardRole[] = ['owner', 'admin'];

export function canEditContent(role: BoardRole | null | undefined): boolean {
  return role !== null && role !== undefined && CONTENT_ROLES.includes(role);
}

export function canGovern(role: BoardRole | null | undefined): boolean {
  return role !== null && role !== undefined && GOVERNANCE_ROLES.includes(role);
}

/** Lifecycle of a single scheduled submission. */
export const SUBMISSION_STATUSES = ['upcoming', 'draft', 'done', 'missed'] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

/** How a checklist recurs. `specific_dates` means hand-picked one-off dates. */
export const SCHEDULE_KINDS = [
  'daily',
  'weekly',
  'monthly',
  'yearly',
  'specific_dates',
] as const;
export type ScheduleKind = (typeof SCHEDULE_KINDS)[number];

/**
 * Whether an item at this depth may take children.
 *
 * Lives beside `MAX_ITEM_DEPTH` rather than in `checklists.ts` for a reason
 * that is about bundle size, not tidiness: this module has no Zod dependency and
 * that one does. The checklist builder is a client component and needs only this
 * test, so keeping it here lets the browser import `@app/core/constants` and
 * leave the schemas — and Zod — on the server.
 */
export function canNestUnder(depth: number): boolean {
  return depth < MAX_ITEM_DEPTH;
}

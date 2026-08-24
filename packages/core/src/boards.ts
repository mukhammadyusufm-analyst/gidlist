import { z } from 'zod';

import { BOARD_ROLES } from './constants';

/**
 * Board and membership validation, shared by web and mobile.
 */

export const boardNameSchema = z
  .string()
  .trim()
  .min(1, { error: 'Give the board a name.' })
  .max(120, { error: 'Name must be 120 characters or fewer.' });

export const createBoardSchema = z.object({
  name: boardNameSchema,
});

export const updateBoardSchema = z.object({
  boardId: z.uuid(),
  name: boardNameSchema,
  description: z
    .string()
    .trim()
    .max(500, { error: 'Description must be 500 characters or fewer.' })
    .optional(),
});

/**
 * Roles an admin may hand out.
 *
 * `owner` is deliberately excluded. There is exactly one owner, changed only by
 * an explicit transfer, and the database enforces that independently — this
 * just keeps the impossible option off the dropdown.
 */
export const assignableRoleSchema = z.enum(
  BOARD_ROLES.filter((r) => r !== 'owner') as ['admin', 'editor', 'member'],
);

export const inviteMemberSchema = z.object({
  boardId: z.uuid(),
  email: z.email({ error: 'Enter a valid email address.' }),
  role: assignableRoleSchema,
});

export const updateMemberRoleSchema = z.object({
  memberId: z.uuid(),
  boardId: z.uuid(),
  role: assignableRoleSchema,
});

export const removeMemberSchema = z.object({
  memberId: z.uuid(),
  boardId: z.uuid(),
});

/**
 * Logo upload limits, mirroring the bucket's own constraints.
 *
 * The bucket rejects anything larger or of the wrong type regardless — this
 * exists so the user is told immediately instead of after a slow upload.
 */
export const MAX_LOGO_BYTES = 2 * 1024 * 1024;
export const ALLOWED_LOGO_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
] as const;

export type CreateBoardInput = z.infer<typeof createBoardSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

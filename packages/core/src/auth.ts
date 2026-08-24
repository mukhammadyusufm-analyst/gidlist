import { z } from 'zod';

/**
 * Auth input validation.
 *
 * These schemas run on the client for instant feedback AND again on the server
 * before anything touches Supabase. Client-side validation is a convenience,
 * never a control — a request can always be forged, so the server repeats it.
 */

export const emailSchema = z.email({ error: 'Enter a valid email address.' });

/**
 * Supabase enforces a 6-character minimum by default. We ask for 8 because the
 * difference costs the user nothing and meaningfully raises the floor against
 * credential stuffing, which is the realistic threat for a B2B tool.
 */
export const passwordSchema = z
  .string()
  .min(8, { error: 'Password must be at least 8 characters.' })
  .max(72, { error: 'Password must be 72 characters or fewer.' });

export const signUpSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, { error: 'Enter your name.' })
    .max(120, { error: 'Name must be 120 characters or fewer.' }),
  email: emailSchema,
  password: passwordSchema,
});

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { error: 'Enter your password.' }),
});

export const resetRequestSchema = z.object({
  email: emailSchema,
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type ResetRequestInput = z.infer<typeof resetRequestSchema>;

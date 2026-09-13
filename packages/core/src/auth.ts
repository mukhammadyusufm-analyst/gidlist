import { z } from 'zod';

/**
 * Auth input validation.
 *
 * These schemas run on the server before anything touches Supabase. Validation
 * in a browser is a convenience, never a control — a request can always be
 * forged, so the server checks regardless.
 *
 * THE MESSAGES ARE TRANSLATION KEYS, NOT SENTENCES. They were English, and they
 * reached every form in English whatever language the person had chosen. The
 * action that runs a schema translates its field errors before returning them —
 * see `translateFieldErrors` in `apps/web/src/lib/errors.ts` — and every key
 * here exists in all three catalogues.
 */

export const emailSchema = z.email({ error: 'errors.emailInvalid' });

/**
 * Supabase enforces a 6-character minimum by default. We ask for 8 because the
 * difference costs the user nothing and meaningfully raises the floor against
 * credential stuffing, which is the realistic threat for a B2B tool.
 */
export const passwordSchema = z
  .string()
  .min(8, { error: 'errors.passwordTooShort' })
  .max(72, { error: 'errors.passwordTooLong' });

export const signUpSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, { error: 'errors.nameRequired' })
    .max(120, { error: 'errors.nameTooLong120' }),
  email: emailSchema,
  password: passwordSchema,
});

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { error: 'errors.passwordRequired' }),
});

export const resetRequestSchema = z.object({
  email: emailSchema,
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type ResetRequestInput = z.infer<typeof resetRequestSchema>;

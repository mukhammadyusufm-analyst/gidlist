'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { signInSchema, signUpSchema, resetRequestSchema } from '@app/core';

import { createClient } from '@/lib/supabase/server';

/**
 * Result shape shared by every auth form.
 *
 * `fieldErrors` drives inline messages under each input; `formError` is for
 * failures that belong to the submission as a whole, like bad credentials.
 */
export type AuthState = {
  formError?: string;
  fieldErrors?: Record<string, string[]>;
  notice?: string;
  /**
   * When this result was produced, set on every failure.
   *
   * The CAPTCHA widget keys itself on this. A Turnstile token is single use, so
   * after a refused submission the widget is still holding one Supabase will
   * reject — and the second attempt fails on the challenge rather than on
   * whatever was actually wrong. A value that changes per failure remounts the
   * widget and fetches a fresh token, including when somebody mistypes the same
   * password twice and the error text is identical.
   */
  at?: number;
};

/** Read the challenge token, if the form carried one. */
function captchaToken(formData: FormData): string | undefined {
  const token = String(formData.get('captchaToken') ?? '');
  return token || undefined;
}

/**
 * Only allow redirects to a path inside this app.
 *
 * The `next` parameter arrives from the URL, so a visitor controls it. Without
 * this check, `/login?next=https://evil.example` would produce a link that
 * looks like our domain but lands on someone else's — a phishing primitive.
 * Requiring a leading `/` and rejecting `//` (protocol-relative URLs) confines
 * it to our own routes.
 */
function safeRedirectPath(raw: FormDataEntryValue | null): string {
  const value = typeof raw === 'string' ? raw : '';
  if (!value.startsWith('/') || value.startsWith('//')) return '/dashboard';
  return value;
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    ...parsed.data,
    options: { captchaToken: captchaToken(formData) },
  });

  if (error) {
    /*
     * A refused challenge is reported as itself. Folding it into the credentials
     * message would tell somebody their password is wrong when it is not, and
     * they would keep retyping a correct password — the one case where the vague
     * message below does harm rather than good.
     */
    if (/captcha/i.test(error.message)) {
      return {
        formError: 'The verification check did not pass. Try again in a moment.',
        at: Date.now(),
      };
    }

    // Deliberately vague. Distinguishing "no such account" from "wrong
    // password" would let anyone test whether a given email is registered.
    return {
      formError: 'That email and password combination is not correct.',
      at: Date.now(),
    };
  }

  // redirect() works by throwing, so it must sit outside any try/catch that
  // would swallow the control-flow exception.
  redirect(safeRedirectPath(formData.get('next')));
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signUpSchema.safeParse({
    fullName: formData.get('fullName'),
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { fullName, email, password } = parsed.data;
  const supabase = await createClient();

  // Built from the live request rather than a hardcoded constant so the
  // confirmation link is correct on localhost, on Vercel previews, and in
  // production without a per-environment setting.
  const headerList = await headers();
  const origin = headerList.get('origin') ?? `https://${headerList.get('host')}`;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Read by the handle_new_user() trigger to populate profiles.full_name.
      data: { full_name: fullName },
      emailRedirectTo: `${origin}/auth/callback`,
      captchaToken: captchaToken(formData),
    },
  });

  if (error) {
    return { formError: error.message, at: Date.now() };
  }

  // With email confirmation on (the default, and what you want), Supabase
  // returns a user but no session. Sending them to the dashboard here would
  // just bounce them back to /login.
  if (!data.session) {
    return {
      notice: `Check ${email} for a confirmation link to finish creating your account.`,
    };
  }

  redirect('/dashboard');
}

export async function requestPasswordReset(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = resetRequestSchema.safeParse({ email: formData.get('email') });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const headerList = await headers();
  const origin = headerList.get('origin') ?? `https://${headerList.get('host')}`;

  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/account/password`,
    captchaToken: captchaToken(formData),
  });

  // Always the same reply, sent whether or not the address exists — otherwise
  // this endpoint becomes a way to enumerate who has an account.
  return {
    notice: 'If an account exists for that address, a reset link is on its way.',
  };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

import 'server-only';

/**
 * Outbound email.
 *
 * Deliberately a thin wrapper over the provider's HTTP API rather than their
 * SDK: it is one fetch call, and swapping provider means editing this file
 * instead of changing a dependency and every call site.
 *
 * Kept out of `lib/env.ts` on purpose. That file is imported by the browser
 * Supabase client, so a server-only secret validated there would either be
 * absent at runtime or — worse — end up in the bundle.
 *
 * Everything here degrades quietly. Email is a notification, not the record:
 * the invitation itself lives in the database and works whether or not a
 * message ever arrives. Sending must never be able to fail an invitation.
 */

export type SendResult = { sent: boolean; reason?: 'not_configured' | 'failed'; error?: string };

const ENDPOINT = 'https://api.resend.com/emails';

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

/**
 * The address people click back to.
 *
 * Falls back through the Vercel-provided host so a preview deployment links to
 * itself rather than to localhost.
 */
export function appUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit.replace(/\/$/, '');

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;

  return 'http://localhost:3000';
}

export async function sendEmail(args: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendResult> {
  if (!isEmailConfigured()) {
    return { sent: false, reason: 'not_configured' };
  }

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [args.to],
        subject: args.subject,
        html: args.html,
        text: args.text,
      }),
      // A slow provider must not hold a form submission open indefinitely.
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const body = await response.text();
      // Logged rather than surfaced: the person inviting cannot act on a
      // provider error, and the invitation itself succeeded.
      console.error(`Email send failed (${response.status}): ${body}`);
      return { sent: false, reason: 'failed', error: `${response.status}` };
    }

    return { sent: true };
  } catch (error) {
    console.error('Email send failed:', error);
    return { sent: false, reason: 'failed', error: String(error) };
  }
}

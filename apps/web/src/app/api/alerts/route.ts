import { NextResponse, type NextRequest } from 'next/server';

import { sendEmail, isEmailConfigured } from '@/lib/email/send';

/**
 * Turn an operational alert into an email.
 *
 * WHY THIS EXISTS. Two things need to raise an alarm: the application, which
 * runs in Node and can call Resend directly, and the database, which cannot.
 * `notify_ops()` reaches the outside world through `net.http_post`, and that
 * call sends `Content-Type` and nothing else — no `Authorization` header. Resend
 * refuses a request without one.
 *
 * The alternatives were worse. Teaching `notify_ops` to send an auth header
 * means a second Vault secret holding the Resend key on every database, and the
 * Resend body shape (`from`, `to`, `subject`) hard-coded in SQL, so changing
 * email provider becomes a migration. Instead the database posts a plain fact —
 * "this job is stale" — to this endpoint, and the decision to render it as email
 * lives with the rest of the email code.
 *
 * WHY THE SECRET IS IN THE URL. Same constraint: the caller cannot set headers.
 * The whole URL is therefore the credential, stored in the `error_webhook_url`
 * Vault secret, which is exactly how Slack and Telegram webhook URLs work. It
 * travels over TLS, where the path and query are encrypted. Treat that URL as a
 * password: anything holding it can send you email.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Fields the database sends for a stale scheduled job. */
type JobStalePayload = {
  kind?: string;
  job?: string;
  last_success?: string | null;
  tolerated_silence?: string;
  external?: boolean;
  detected_at?: string;
};

/** Fields the application's error reporter sends, if it is ever pointed here. */
type ErrorPayload = {
  text?: string;
  message?: string;
  route?: string;
  path?: string;
  digest?: string;
};

function describe(payload: JobStalePayload & ErrorPayload): {
  subject: string;
  lines: string[];
} {
  if (payload.kind === 'job-stale') {
    const job = payload.job ?? 'unknown job';
    return {
      subject: `Gidlist: scheduled job "${job}" has stopped`,
      lines: [
        `The scheduled job "${job}" has not reported success for longer than expected.`,
        '',
        `Last success: ${payload.last_success ?? 'never recorded'}`,
        `Tolerated silence: ${payload.tolerated_silence ?? 'unknown'}`,
        `Detected at: ${payload.detected_at ?? new Date().toISOString()}`,
        payload.external
          ? 'This job runs outside the database, so check the scheduler as well as the database.'
          : 'This job runs inside the database, on pg_cron.',
      ],
    };
  }

  // Anything else: render what arrived rather than dropping it. An alert with an
  // unrecognised shape is still an alert, and silently discarding it would make
  // this endpoint the thing that loses the message.
  const headline = payload.text ?? payload.message ?? 'Gidlist alert';
  return {
    subject: `Gidlist: ${headline.split('\n')[0].slice(0, 120)}`,
    lines: [
      headline,
      '',
      payload.route ? `route: ${payload.route}` : '',
      payload.path ? `path: ${payload.path}` : '',
      payload.digest ? `digest: ${payload.digest}` : '',
    ].filter(Boolean),
  };
}

export async function POST(request: NextRequest) {
  const secret = process.env.ALERT_WEBHOOK_SECRET;

  // Refusing when unset, for the same reason the cleanup route does: a missing
  // variable must not turn this into an open endpoint that sends mail.
  if (!secret || request.nextUrl.searchParams.get('key') !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const to = process.env.ALERT_EMAIL;
  if (!to || !isEmailConfigured()) {
    // 200, not an error. The caller is `net.http_post`, which cannot read a
    // response and would retry nothing; and an unconfigured destination is a
    // deployment choice, not a failure of the alert.
    console.warn('[alerts] received an alert but no destination is configured');
    return NextResponse.json({ sent: false, reason: 'not_configured' });
  }

  let payload: JobStalePayload & ErrorPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body was not JSON' }, { status: 400 });
  }

  const { subject, lines } = describe(payload);
  const text = lines.join('\n');

  const result = await sendEmail({
    to,
    subject,
    text,
    // Plain and deliberately ugly. This is read at three in the morning on a
    // phone, and anything that needs a stylesheet to be legible is wrong here.
    html: `<pre style="font:14px/1.5 ui-monospace,monospace;white-space:pre-wrap">${lines
      .map((line) => line.replace(/[<>&]/g, (c) => `&#${c.charCodeAt(0)};`))
      .join('\n')}</pre>`,
  });

  // Logged either way: this is the only place that knows whether the alarm
  // actually reached anybody.
  if (result.sent) {
    console.log('[alerts] sent:', subject);
  } else {
    console.error('[alerts] could not send:', subject, result.reason, result.error);
  }

  return NextResponse.json(result);
}

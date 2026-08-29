import 'server-only';

/**
 * Where production errors go.
 *
 * Two destinations, and both matter for different reasons:
 *
 *   stderr, as one line of JSON   always. Vercel keeps it, and structured
 *                                 output is the difference between filtering
 *                                 logs and reading them.
 *
 *   a webhook, if configured      because a log nobody opens is not
 *                                 monitoring. This is the half that reaches
 *                                 you when something breaks at 2am.
 *
 * Provider-agnostic on purpose, the same shape as `lib/email/send.ts`: the URL
 * can point at a Telegram bot, a Slack hook, or a hosted error service, and
 * swapping means changing an environment variable rather than code.
 *
 * NOTHING HERE MAY THROW. An error reporter that fails while reporting an error
 * turns one broken page into an unhandled rejection inside the framework's own
 * error path, which is how a small fault becomes an outage.
 */

/**
 * Headers are never forwarded, and this is not caution — it is the whole reason
 * this file exists rather than a one-line fetch.
 *
 * `request.headers` from Next includes `cookie`, which on this app carries the
 * Supabase session. Posting that to a webhook would hand a working login for
 * whoever hit the error to whatever service is on the other end, and to anyone
 * who later reads that channel's history. The same applies to `authorization`.
 *
 * So the payload is built from an allow-list of harmless fields rather than by
 * removing known-bad ones: a deny-list is one Next.js release away from leaking
 * a field nobody thought to exclude.
 */
export type ErrorReport = {
  message: string;
  /** React's error digest, when the original error was replaced during render. */
  digest?: string;
  /** Route file, e.g. /dashboard/boards/[slug]. Not the visited URL. */
  route?: string;
  /** render | route | action | proxy — where in the request it failed. */
  kind?: string;
  method?: string;
  /** Path with any query string removed; a query can carry an email or a token. */
  path?: string;
  stack?: string;
};

/**
 * One notification per distinct error every ten minutes.
 *
 * A broken page does not fail once — it fails for every visitor, on every
 * reload, and without this a single fault sends hundreds of messages. That is
 * worse than silence, because the channel becomes something you mute.
 *
 * Per-instance and in memory, so it is imperfect on serverless where instances
 * come and go. It is a volume cap, not a guarantee, and the log line is always
 * written regardless.
 */
const NOTIFY_COOLDOWN_MS = 10 * 60 * 1000;
const lastNotified = new Map<string, number>();

function shouldNotify(signature: string): boolean {
  const now = Date.now();
  const previous = lastNotified.get(signature);
  if (previous && now - previous < NOTIFY_COOLDOWN_MS) return false;

  lastNotified.set(signature, now);

  // The map would otherwise grow for the lifetime of the instance, one entry
  // per distinct error — which is small, until an error message contains
  // something that varies per request.
  if (lastNotified.size > 200) {
    for (const [key, at] of lastNotified) {
      if (now - at > NOTIFY_COOLDOWN_MS) lastNotified.delete(key);
    }
  }

  return true;
}

export function isErrorWebhookConfigured(): boolean {
  return Boolean(process.env.ERROR_WEBHOOK_URL || process.env.ALERT_EMAIL);
}

/**
 * Email the report, when `ALERT_EMAIL` is set.
 *
 * Sent directly rather than through `/api/alerts`, even though that endpoint
 * exists and would work. The endpoint is for the database, which has no other
 * way out. Routing the application's own errors through an application route
 * means that when the app is what is broken, the path carrying the alarm is the
 * broken thing — and an error raised *inside* `/api/alerts` would be reported by
 * posting to `/api/alerts`.
 */
async function emailReport(report: ErrorReport, lines: string[]): Promise<void> {
  const to = process.env.ALERT_EMAIL;
  if (!to) return;

  // Imported here rather than at module scope: this file is pulled in by the
  // instrumentation hook on every server start, and the email module reads
  // configuration that a deployment without email need not have.
  const { sendEmail, isEmailConfigured } = await import('@/lib/email/send');
  if (!isEmailConfigured()) return;

  const body = lines.join('\n');
  await sendEmail({
    to,
    subject: `Gidlist error: ${report.message.slice(0, 120)}`,
    text: body,
    html: `<pre style="font:14px/1.5 ui-monospace,monospace;white-space:pre-wrap">${body.replace(
      /[<>&]/g,
      (c) => `&#${c.charCodeAt(0)};`,
    )}</pre>`,
  });
}

export async function reportError(report: ErrorReport): Promise<void> {
  try {
    // Always. Structured so it can be filtered rather than scrolled, and
    // prefixed so a search for one token finds every error the app produced.
    console.error(
      JSON.stringify({
        tag: 'app-error',
        at: new Date().toISOString(),
        ...report,
      }),
    );

    const webhook = process.env.ERROR_WEBHOOK_URL;
    const email = process.env.ALERT_EMAIL;
    if (!webhook && !email) return;

    // Grouped by where and what, not by the full message: an error carrying an
    // id would otherwise defeat the cooldown by looking new every time.
    const signature = `${report.route ?? report.path ?? 'unknown'}::${report.message.slice(0, 120)}`;
    if (!shouldNotify(signature)) return;

    const lines = [
      `Gidlist error: ${report.message}`,
      report.route ? `route: ${report.route}` : null,
      report.path ? `path: ${report.path}` : null,
      report.kind ? `where: ${report.kind}` : null,
      report.digest ? `digest: ${report.digest}` : null,
      // A type guard rather than `filter(Boolean)`, which does not narrow away
      // the nulls and leaves the array unusable as `string[]`.
    ].filter((line): line is string => line !== null);

    await emailReport(report, lines);

    if (!webhook) return;

    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // `text` suits Telegram and Slack; anything else can read the fields.
      body: JSON.stringify({ text: lines.join('\n'), ...report }),
      // A slow or hanging webhook must not hold the error path open.
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    // Deliberately silent, and deliberately not console.error: if the reporter
    // is what is failing, logging from inside its own catch is how you fill a
    // log with the reporter complaining about itself.
  }
}

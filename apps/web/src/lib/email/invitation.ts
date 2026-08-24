import 'server-only';

import { resolveMessages, translate, type Locale } from '@app/core';

import { CATALOGUE } from '@/lib/i18n/catalogue';
import { appUrl, sendEmail, type SendResult } from './send';

/**
 * The invitation email.
 *
 * Written in the *inviter's* language, which is the best available guess: the
 * recipient has no profile yet, so their preference is unknown, and the person
 * inviting is almost always working in the language their organisation uses.
 *
 * Deliberately plain HTML with inline styles. Email clients strip <style>
 * blocks, ignore most modern CSS, and Outlook renders through Word — a layout
 * that survives that is a table and inline attributes, not the app's stylesheet.
 */
export async function sendInvitationEmail(input: {
  to: string;
  spaceName: string;
  inviterName: string;
  roleKey: string;
  locale: Locale;
  /** True when no account exists for this address yet. */
  needsAccount: boolean;
}): Promise<SendResult> {
  const messages = resolveMessages(CATALOGUE, input.locale);
  const t = (key: string, values?: Record<string, string | number>) =>
    translate(messages, key, values);

  const role = t(input.roleKey);
  const url = `${appUrl()}/dashboard`;

  const subject = t('email.inviteSubject', {
    inviter: input.inviterName,
    space: input.spaceName,
  });

  const body = t('email.inviteBody', {
    inviter: input.inviterName,
    space: input.spaceName,
    role,
  });

  const nextStep = input.needsAccount ? t('email.inviteNoAccount') : t('email.inviteHasAccount');

  const text = [body, '', nextStep, '', url, '', t('email.inviteFooter')].join('\n');

  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.55;color:#18181b;max-width:520px;margin:0 auto;padding:24px">
  <p style="font-size:16px;margin:0 0 16px">${escapeHtml(body)}</p>
  <p style="font-size:15px;color:#52525b;margin:0 0 24px">${escapeHtml(nextStep)}</p>
  <p style="margin:0 0 28px">
    <a href="${escapeHtml(url)}"
       style="display:inline-block;background:#2a78d6;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:6px;font-weight:600;font-size:15px">
      ${escapeHtml(t('email.inviteCta'))}
    </a>
  </p>
  <p style="font-size:13px;color:#71717a;margin:0">${escapeHtml(t('email.inviteFooter'))}</p>
</div>`.trim();

  return sendEmail({ to: input.to, subject, html, text });
}

/**
 * Escape before interpolation.
 *
 * A space name is user-supplied and lands inside markup that is emailed to
 * someone else — the one place in this app where untrusted text is assembled
 * into HTML by hand rather than by React, which escapes for us.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

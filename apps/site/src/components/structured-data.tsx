import { isVisible, type SiteMessages } from '@app/core';

import type { Plan } from '@/lib/pricing';
import { SITE_LOCALES, type BuiltinLocale } from '@/lib/i18n/locale';
import { SITE_URL } from '@/lib/site';
import { COMPANY_NAME } from '@/lib/legal';

/**
 * JSON-LD: what this is, who makes it, and the questions it answers.
 *
 * GENERATED FROM THE SAME STRINGS THE PAGE RENDERS, never from a second copy.
 * Structured data that disagrees with the visible page is worse than none — a
 * search engine treats the mismatch as an attempt to mislead it, and the usual
 * cause is exactly this: a hand-written block of JSON nobody updated when the
 * copy changed. Reading from `m` and the real plans makes that impossible.
 *
 * The FAQ entries respect the same visibility rules as the section itself, so
 * hiding a question in the admin screen also removes it from the structured
 * data rather than leaving it advertised to crawlers and absent from the page.
 *
 * Prices come from the database, so what is published here is what a customer
 * is actually charged.
 */

export function StructuredData({
  locale,
  m,
  plans,
}: {
  locale: BuiltinLocale;
  m: SiteMessages;
  plans: Plan[];
}) {
  const home = `${SITE_URL}/${locale}`;

  const organisation = {
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organisation`,
    name: COMPANY_NAME,
    url: SITE_URL,
    // Registered address deliberately omitted — see lib/legal.ts.
  };

  const application = {
    '@type': 'SoftwareApplication',
    '@id': `${SITE_URL}/#app`,
    name: 'Gidlist',
    url: home,
    applicationCategory: 'BusinessApplication',
    // It runs in a browser; there is nothing to install from a store, and
    // claiming an operating system would be a claim about an app that does not
    // exist.
    operatingSystem: 'Web',
    inLanguage: SITE_LOCALES.map((l) => l),
    description: m.metaDescription,
    publisher: { '@id': `${SITE_URL}/#organisation` },
    offers: plans.map((plan) => ({
      '@type': 'Offer',
      name: plan.name,
      price: (plan.priceMinor / 100).toFixed(2),
      priceCurrency: plan.currency,
      url: `${home}#pricing`,
    })),
  };

  const faqs = m.faqItems.filter((item) => item.q.trim().length > 0 && isVisible(item.visible));

  const graph: object[] = [organisation, application];

  if (isVisible(m.faqVisible) && faqs.length > 0) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${home}#faq`,
      mainEntity: faqs.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      })),
    });
  }

  const json = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph });

  return (
    <script
      type="application/ld+json"
      // The string is built from our own data, not from anything a visitor can
      // reach, and JSON.stringify escapes the quotes that would break out of it.
      dangerouslySetInnerHTML={{ __html: json.replace(/</g, '\\u003c') }}
    />
  );
}

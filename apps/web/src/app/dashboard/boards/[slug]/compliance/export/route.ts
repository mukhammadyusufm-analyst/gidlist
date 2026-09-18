import { NextResponse, type NextRequest } from 'next/server';

import { getBoardBySlug } from '@/lib/boards/queries';
import {
  getComplianceData,
  parseComplianceSearch,
  type ComplianceRow,
} from '@/lib/compliance/queries';
import { getTranslations } from '@/lib/i18n/server';
import { getToday } from '@/lib/timezone/server';

/**
 * The Compliance table as a spreadsheet, with the filters that are on screen.
 *
 * Every matching row, not one page: this is what goes to head office, an
 * auditor or a client with an invoice. Read through the viewer's own session,
 * so Row Level Security decides what is in it exactly as it does on screen.
 *
 * CSV with a byte-order mark, because Excel otherwise opens UTF-8 as a legacy
 * code page and every Uzbek and Russian word arrives as mojibake.
 */

// ponytail: 5,000 rows in 200-row pages; stream it if spaces outgrow that.
const MAX_ROWS = 5000;
const BATCH = 200;

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const board = await getBoardBySlug(slug);
  if (!board) return new NextResponse('Not found', { status: 404 });

  const { t, locale } = await getTranslations();
  const search = Object.fromEntries(request.nextUrl.searchParams);
  const filters = parseComplianceSearch(search, await getToday());

  const rows: ComplianceRow[] = [];
  for (let page = 1; rows.length < MAX_ROWS; page++) {
    const data = await getComplianceData(board.id, { ...filters, page, pageSize: BATCH });
    rows.push(...data.rows);
    if (page >= data.pageCount) break;
  }

  const time = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' }) : '';

  const header = [
    t('compliance.date'),
    t('compliance.checklist'),
    t('compliance.assignee'),
    t('compliance.filledBy'),
    t('compliance.status'),
    t('compliance.exportTicked'),
    t('compliance.exportAttachments'),
    t('compliance.exportSubmittedAt'),
    t('compliance.exportCompletedAt'),
    t('compliance.exportVoidReason'),
  ];

  const body = rows.map((r) => [
    r.due_date,
    r.checklist_title,
    r.assignee_email ?? t('common.everyone'),
    r.submitted_by_email ?? '',
    t(`status.${r.status}`),
    r.items_total ? `${r.items_ticked}/${r.items_total}` : '',
    String(r.attachments),
    time(r.submitted_at),
    time(r.completed_at),
    r.voided_at ? (r.void_reason ?? '—') : '',
  ]);

  const csv = '﻿' + [header, ...body].map((line) => line.map(cell).join(',')).join('\r\n');
  const name = `gidlist-${board.slug}-${filters.from}-${filters.to}.csv`;

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}

/**
 * One CSV cell, quoted and made safe to open.
 *
 * A cell starting with = + - @ is run as a formula by Excel and Sheets — and a
 * checklist title is typed by users, so "=HYPERLINK(…)" in a title would become
 * a live link in an auditor's spreadsheet. A leading apostrophe makes it text.
 */
function cell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

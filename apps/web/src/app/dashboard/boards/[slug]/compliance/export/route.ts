import { NextResponse, type NextRequest } from 'next/server';

import { getBoardBySlug } from '@/lib/boards/queries';
import { getComplianceData, parseComplianceSearch } from '@/lib/compliance/queries';
import { getRecordItems } from '@/lib/compliance/items';
import { getTranslations } from '@/lib/i18n/server';
import { getTimezone, getToday } from '@/lib/timezone/server';

/**
 * The Compliance records as a spreadsheet, ONE ROW PER ITEM, with the filters
 * that are on screen.
 *
 * Per item rather than per record because the question a manager takes to
 * Excel is about the work inside: which branch skipped the freezer reading,
 * which item is never ticked. Each row repeats its record's date, checklist,
 * people and status, so the sheet filters and pivots on either level. A record
 * nobody opened has no items and appears once, with the item columns blank.
 *
 * No value is written in a shape Excel rewrites. A tick count of "3/5" was
 * turned into the 3rd of May, so there are no fractions; done is Yes/No, and
 * times are "YYYY-MM-DD HH:MM" in the viewer's own timezone — not the
 * server's, which is UTC.
 *
 * CSV with a byte-order mark, because Excel otherwise opens UTF-8 as a legacy
 * code page and every Uzbek and Russian word arrives as mojibake. Read through
 * the viewer's session, so Row Level Security decides what is in it.
 */

// ponytail: 5,000 records in 200-record pages; stream it if spaces outgrow that.
const MAX_RECORDS = 5000;
const BATCH = 200;

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const board = await getBoardBySlug(slug);
  if (!board) return new NextResponse('Not found', { status: 404 });

  const [{ t }, timeZone] = await Promise.all([getTranslations(), getTimezone()]);
  const filters = parseComplianceSearch(Object.fromEntries(request.nextUrl.searchParams), await getToday());

  // en-CA formats as 2026-09-18, 07:42 — unambiguous in every locale.
  const clock = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const time = (iso: string | null) => (iso ? clock.format(new Date(iso)).replace(', ', ' ') : '');
  const yes = t('compliance.exportYes');
  const no = t('compliance.exportNo');

  const lines: string[][] = [
    [
      t('compliance.date'),
      t('compliance.checklist'),
      t('compliance.assignee'),
      t('compliance.filledBy'),
      t('compliance.status'),
      t('compliance.exportSubmittedAt'),
      t('compliance.exportCompletedAt'),
      t('compliance.exportVoidReason'),
      t('compliance.exportSection'),
      t('compliance.exportItem'),
      t('compliance.exportDone'),
      t('compliance.exportTickedAt'),
      t('compliance.exportNote'),
      t('compliance.exportPhoto'),
      t('compliance.exportFile'),
    ],
  ];

  let fetched = 0;
  for (let page = 1; fetched < MAX_RECORDS; page++) {
    const data = await getComplianceData(board.id, { ...filters, page, pageSize: BATCH });
    const items = await getRecordItems(data.rows);
    fetched += data.rows.length;

    for (const r of data.rows) {
      const record = [
        r.due_date,
        r.checklist_title,
        r.assignee_email ?? t('common.everyone'),
        r.submitted_by_email ?? '',
        t(`status.${r.status}`),
        time(r.submitted_at),
        time(r.completed_at),
        r.voided_at ? (r.void_reason ?? yes) : '',
      ];
      const list = items.get(r.id) ?? [];
      if (list.length === 0) lines.push([...record, '', '', '', '', '', '', '']);
      for (const item of list) {
        lines.push([
          ...record,
          item.section,
          // Indented so sub-items read as sub-items in the sheet.
          `${'    '.repeat(item.depth)}${item.title}`,
          item.checked ? yes : no,
          time(item.checkedAt),
          item.note ?? '',
          item.photo ? yes : '',
          item.file ? yes : '',
        ]);
      }
    }

    if (page >= data.pageCount) break;
  }

  const csv = '﻿' + lines.map((line) => line.map(cell).join(',')).join('\r\n');
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

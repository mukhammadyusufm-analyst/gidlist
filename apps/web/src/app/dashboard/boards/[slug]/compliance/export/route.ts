import { NextResponse, type NextRequest } from 'next/server';

import { getBoardBySlug } from '@/lib/boards/queries';
import { getComplianceData, parseComplianceSearch, type ComplianceRow } from '@/lib/compliance/queries';
import { getRecordItems, type RecordItem } from '@/lib/compliance/items';
import { getTranslations } from '@/lib/i18n/server';
import { getTimezone, getToday } from '@/lib/timezone/server';

/**
 * The Compliance records as a spreadsheet, ONE ROW PER FILL-IN, with the
 * filters that are on screen, and what happened to the items inside it.
 *
 * One row per item was tried first and read as five records for a five-item
 * checklist. Now each fill-in is one row, and the items travel with it — as
 * their own columns when the export is one checklist, and always as "not done"
 * and "notes" lists.
 *
 * No value is written in a shape Excel rewrites. A tick count of "3/5" was
 * turned into the 3rd of May, so there are no fractions; an item is ✓ with its time or ✗, and
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

  const records: { row: ComplianceRow; items: RecordItem[] }[] = [];
  for (let page = 1; records.length < MAX_RECORDS; page++) {
    const data = await getComplianceData(board.id, { ...filters, page, pageSize: BATCH });
    const items = await getRecordItems(data.rows);
    for (const row of data.rows) records.push({ row, items: items.get(row.id) ?? [] });
    if (page >= data.pageCount) break;
  }

  /*
   * ONE CHECKLIST IN THE EXPORT: one column per item. A row is then a fill-in
   * read across, like a paper log — ✓ 07:42 or ✗ under each item. Keyed by
   * item title rather than id, so an item that survived a new version stays
   * one column; columns appear in the order the items first do.
   *
   * SEVERAL CHECKLISTS: item columns would be mostly empty, so the sheet keeps
   * to one row per fill-in with "not done" and "notes" as lists.
   */
  const singleChecklist = new Set(records.map((r) => r.row.checklist_id)).size === 1;
  const itemColumns = singleChecklist
    ? [...new Set(records.flatMap((r) => r.items.map((i) => i.title)))]
    : [];

  const lines: string[][] = [
    [
      t('compliance.date'),
      t('compliance.checklist'),
      t('compliance.assignee'),
      t('compliance.filledBy'),
      t('compliance.status'),
      t('compliance.exportDone'),
      t('compliance.exportNotDone'),
      t('compliance.exportNotes'),
      t('compliance.exportAttachments'),
      t('compliance.exportSubmittedAt'),
      t('compliance.exportCompletedAt'),
      t('compliance.exportVoidReason'),
      ...itemColumns,
    ],
  ];

  for (const { row: r, items } of records) {
    const byTitle = new Map(items.map((i) => [i.title, i]));
    const ticked = items.filter((i) => i.checked).length;
    const hhmm = (iso: string | null) => time(iso).slice(11);

    lines.push([
      r.due_date,
      r.checklist_title,
      r.assignee_email ?? t('common.everyone'),
      r.submitted_by_email ?? '',
      t(`status.${r.status}`),
      // Words, not "4/6": Excel reads a fraction as a date.
      items.length ? t('compliance.reportTicked', { done: ticked, total: items.length }) : '',
      items.filter((i) => !i.checked).map((i) => i.title).join('; '),
      items.filter((i) => i.note).map((i) => `${i.title}: ${i.note}`).join('; '),
      String(items.filter((i) => i.photo || i.file).length || ''),
      time(r.submitted_at),
      time(r.completed_at),
      r.voided_at ? (r.void_reason ?? yes) : '',
      ...itemColumns.map((title) => {
        const item = byTitle.get(title);
        if (!item) return '';
        return item.checked ? `✓ ${hhmm(item.checkedAt)}`.trim() : '✗';
      }),
    ]);
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

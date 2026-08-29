import 'server-only';

import { createClient } from '@/lib/supabase/server';
import type { SubmissionStatus } from '@/lib/supabase/database.types';

export type ComplianceFilters = {
  from: string;
  to: string;
  checklistId?: string;
  status?: SubmissionStatus;
  assigneeEmail?: string;
  page?: number;
};

/**
 * Rows per page in the table.
 *
 * The counts and the chart still cover the whole filtered range — a completion
 * rate that only described the visible page would be meaningless. Only the
 * table is paged.
 */
export const PAGE_SIZE = 50;

export type ComplianceRow = {
  id: string;
  due_date: string;
  status: SubmissionStatus;
  /** Who was asked. Null means anyone on the board could fill it in. */
  assignee_email: string | null;
  /**
   * Who actually did it. Deliberately separate from the assignee: they answer
   * different questions, and reporting one as the other is what made a
   * checklist filled in by a named person show up as "Anyone".
   *
   * Null for anything not yet submitted, and for records completed before the
   * column existed — those were not back-filled.
   */
  submitted_by_email: string | null;
  checklist_id: string;
  checklist_title: string;
  /** Set when somebody decided this record should not count. */
  voided_at: string | null;
  void_reason: string | null;
};

export type ComplianceData = {
  /** The current page of the table. */
  rows: ComplianceRow[];
  page: number;
  pageCount: number;
  counts: Record<SubmissionStatus, number>;
  /** Matching rows across the whole range, not just this page. */
  total: number;
  trend: { date: string; rate: number; done: number; total: number }[];
  checklists: { id: string; title: string }[];
  assignees: string[];
};

const EMPTY_COUNTS: Record<SubmissionStatus, number> = {
  done: 0,
  draft: 0,
  missed: 0,
  upcoming: 0,
};

/**
 * Everything the compliance view needs.
 *
 * The counts and the trend are computed by the database rather than by loading
 * every row and tallying them here. Beyond being faster, it removes a
 * correctness trap: the previous version capped its fetch at 2000 rows, so a
 * busy space would have shown confidently wrong totals with nothing to indicate
 * it.
 *
 * Row Level Security applies inside those functions, so a member's figures
 * cover exactly the rows a member can see — the summary and the table can never
 * disagree about who is included.
 */
export async function getComplianceData(
  boardId: string,
  filters: ComplianceFilters,
): Promise<ComplianceData> {
  const supabase = await createClient();

  const { data: checklists } = await supabase
    .from('checklists')
    .select('id, title')
    .eq('board_id', boardId)
    .order('title');

  const checklistList = checklists ?? [];

  if (checklistList.length === 0) {
    return {
      rows: [],
      page: 1,
      pageCount: 1,
      counts: EMPTY_COUNTS,
      total: 0,
      trend: [],
      checklists: [],
      assignees: [],
    };
  }

  const titles = new Map(checklistList.map((c) => [c.id, c.title]));
  const page = Math.max(1, filters.page ?? 1);
  const offset = (page - 1) * PAGE_SIZE;

  const shared = {
    p_board_id: boardId,
    p_from: filters.from,
    p_to: filters.to,
    p_checklist: filters.checklistId ?? null,
    p_assignee: filters.assigneeEmail ?? null,
  };

  // One page of rows, plus an exact count of how many match in total —
  // PostgREST returns the count in a header, so no extra round trip.
  let rowQuery = supabase
    .from('submissions')
    .select(
      'id, due_date, status, assignee_email, submitted_by_email, checklist_id, voided_at, void_reason',
      { count: 'exact' },
    )
    .in(
      'checklist_id',
      filters.checklistId ? [filters.checklistId] : checklistList.map((c) => c.id),
    )
    .gte('due_date', filters.from)
    .lte('due_date', filters.to)
    .order('due_date', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (filters.status) rowQuery = rowQuery.eq('status', filters.status);
  if (filters.assigneeEmail) rowQuery = rowQuery.eq('assignee_email', filters.assigneeEmail);

  const [rowResult, countResult, trendResult, assigneeResult] = await Promise.all([
    rowQuery,
    supabase.rpc('compliance_counts', shared),
    supabase.rpc('compliance_trend', { ...shared, p_status: filters.status ?? null }),
    supabase.rpc('compliance_assignees', {
      p_board_id: boardId,
      p_from: filters.from,
      p_to: filters.to,
    }),
  ]);

  if (rowResult.error) {
    throw new Error(`Could not load compliance data: ${rowResult.error.message}`);
  }

  const counts = { ...EMPTY_COUNTS };
  for (const row of countResult.data ?? []) {
    counts[row.status as SubmissionStatus] = Number(row.total);
  }

  const trend = (trendResult.data ?? []).map((row) => ({
    date: row.day,
    done: Number(row.done),
    total: Number(row.total),
    rate: Number(row.total) === 0 ? 0 : Math.round((Number(row.done) / Number(row.total)) * 100),
  }));

  const matched = rowResult.count ?? 0;

  return {
    rows: (rowResult.data ?? []).map((r) => ({
      ...r,
      status: r.status,
      checklist_title: titles.get(r.checklist_id) ?? 'Checklist',
    })),
    page,
    pageCount: Math.max(1, Math.ceil(matched / PAGE_SIZE)),
    counts,
    // Summed from the per-status counts so the tiles and this figure are always
    // the same number, whatever filters are applied.
    total: Object.values(counts).reduce((sum, n) => sum + n, 0),
    trend,
    checklists: checklistList,
    assignees: (assigneeResult.data ?? []).map((a) => a.email).filter(Boolean),
  };
}

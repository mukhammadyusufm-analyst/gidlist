'use client';

import { toIsoDate } from '@app/core/dates';

import { DateField } from '@/components/ui/date-field';
import { Button } from '@/components/ui/button';
import { SCHEDULE_DELETED } from '@/lib/compliance/filters';
import { useComplianceFilters } from '@/components/compliance/use-filters';
import { useT } from '@/components/i18n/provider';

const selectClass =
  'min-h-11 w-full rounded-md border border-[var(--color-input)] bg-transparent px-3 py-2 text-sm';

/**
 * The ranges worth one tap, in days.
 *
 * Wording lives in PRESET_KEYS below rather than here — an English label beside
 * each number was carried for a while after the catalogue took over, and a dead
 * string that looks live is one somebody eventually edits expecting an effect.
 */
const PRESET_DAYS = [7, 30, 90];

// Local calendar parts. toISOString would convert to UTC and shift the range by
// a day for anyone east of Greenwich.
const iso = toIsoDate;

export function FilterBar({
  slug,
  from,
  to,
  checklistId,
  status,
  assigneeEmail,
  checklists,
  assignees,
  schedules,
  scheduleId,
}: {
  slug: string;
  from: string;
  to: string;
  checklistId?: string;
  status?: string;
  assigneeEmail?: string;
  checklists: { id: string; title: string }[];
  assignees: string[];
  schedules: { id: string; checklist_id: string; kind: string; start_date: string }[];
  scheduleId?: string;
}) {
  const { update } = useComplianceFilters(slug);
  const { t, locale } = useT();

  const titles = new Map(checklists.map((c) => [c.id, c.title]));

  /*
   * A schedule has no name, so it is labelled by what it does: the checklist,
   * how often, and the day it started. Two daily schedules on one checklist are
   * told apart by that date, which is the only thing that differs.
   */
  const KIND_KEYS: Record<string, string> = {
    daily: 'schedule.daily',
    weekly: 'schedule.weekly',
    monthly: 'schedule.monthly',
    yearly: 'schedule.yearly',
    specific_dates: 'schedule.specificDates',
  };

  const scheduleLabel = (s: { checklist_id: string; kind: string; start_date: string }) =>
    `${titles.get(s.checklist_id) ?? ''} · ${t(KIND_KEYS[s.kind] ?? 'compliance.schedule')} · ${new Date(
      `${s.start_date}T00:00:00`,
    ).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}`;

  // Only the schedules of the checklist being looked at, when one is chosen.
  const shown = checklistId ? schedules.filter((s) => s.checklist_id === checklistId) : schedules;

  const PRESET_KEYS: Record<number, string> = {
    7: 'compliance.last7',
    30: 'compliance.last30',
    90: 'compliance.last90',
  };

  function applyPreset(days: number) {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days + 1);
    update({ from: iso(start), to: iso(end) });
  }

  return (
    <div className="space-y-3 rounded-xl border border-[var(--color-border)] p-4">
      {/* Presets first: picking "last 30 days" is far more common than typing
          two dates, and putting them ahead of the custom range says so. */}
      <div className="flex flex-wrap gap-2">
        {PRESET_DAYS.map((days) => (
          <Button
            key={days}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => applyPreset(days)}
          >
            {t(PRESET_KEYS[days])}
          </Button>
        ))}
      </div>

      {/* DateField, not `<input type="date">`.
          The native control draws its own calendar and labels it from the
          *browser's* locale, with no API to change it — so somebody running the
          app in Uzbek on an English phone picked dates from an English
          calendar. These two were the last native date inputs on a translated
          screen. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="block">
          <label htmlFor="compliance-from" className="mb-1.5 block text-sm font-medium">
            {t('compliance.from')}
          </label>
          <DateField
            id="compliance-from"
            name="from"
            value={from}
            onChange={(iso) => update({ from: iso || undefined })}
          />
        </div>
        <div className="block">
          <label htmlFor="compliance-to" className="mb-1.5 block text-sm font-medium">
            {t('compliance.to')}
          </label>
          <DateField
            id="compliance-to"
            name="to"
            value={to}
            onChange={(iso) => update({ to: iso || undefined })}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">{t('compliance.checklist')}</span>
          <select
            className={selectClass}
            value={checklistId ?? ''}
            onChange={(e) => update({ checklist: e.target.value || undefined })}
          >
            <option value="">{t('compliance.allChecklists')}</option>
            {checklists.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">{t('compliance.status')}</span>
          <select
            className={selectClass}
            value={status ?? ''}
            onChange={(e) => update({ status: e.target.value || undefined })}
          >
            <option value="">{t('compliance.allStatuses')}</option>
            <option value="done">{t('status.done')}</option>
            <option value="draft">{t('status.draft')}</option>
            <option value="missed">{t('status.missed')}</option>
            <option value="upcoming">{t('status.upcoming')}</option>
          </select>
        </label>

        {/* The schedule narrows the table only, not the figures above it —
            those answer "how is this space doing", which is not a question
            about one schedule. Records whose schedule was deleted are their
            own option: they are kept, and otherwise unfindable as a group. */}
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">{t('compliance.schedule')}</span>
          <select
            className={selectClass}
            value={scheduleId ?? ''}
            onChange={(e) => update({ schedule: e.target.value || undefined })}
          >
            <option value="">{t('compliance.allSchedules')}</option>
            <option value={SCHEDULE_DELETED}>{t('compliance.scheduleDeleted')}</option>
            {shown.map((s) => (
              <option key={s.id} value={s.id}>
                {scheduleLabel(s)}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">{t('compliance.assignee')}</span>
          <select
            className={selectClass}
            value={assigneeEmail ?? ''}
            onChange={(e) => update({ assignee: e.target.value || undefined })}
          >
            <option value="">{t('common.everyone')}</option>
            {assignees.map((email) => (
              <option key={email} value={email}>
                {email}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

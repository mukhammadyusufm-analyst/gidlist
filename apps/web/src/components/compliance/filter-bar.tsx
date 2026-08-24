'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { toIsoDate } from '@app/core';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useT } from '@/components/i18n/provider';

const selectClass =
  'min-h-11 w-full rounded-md border border-[var(--color-input)] bg-transparent px-3 py-2 text-base sm:text-sm';

const PRESETS = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
];

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
}: {
  slug: string;
  from: string;
  to: string;
  checklistId?: string;
  status?: string;
  assigneeEmail?: string;
  checklists: { id: string; title: string }[];
  assignees: string[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const { t } = useT();

  const PRESET_KEYS: Record<number, string> = {
    7: 'compliance.last7',
    30: 'compliance.last30',
    90: 'compliance.last90',
  };

  function update(changes: Record<string, string | undefined>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    router.push(`/dashboard/boards/${slug}/compliance?${next.toString()}`);
  }

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
        {PRESETS.map((preset) => (
          <Button
            key={preset.days}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => applyPreset(preset.days)}
          >
            {t(PRESET_KEYS[preset.days])}
          </Button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">{t('compliance.from')}</span>
          <Input type="date" value={from} onChange={(e) => update({ from: e.target.value })} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">{t('compliance.to')}</span>
          <Input type="date" value={to} onChange={(e) => update({ to: e.target.value })} />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
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

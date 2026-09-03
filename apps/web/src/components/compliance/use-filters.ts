'use client';

import { useRouter, useSearchParams } from 'next/navigation';

/**
 * One way to change a compliance filter.
 *
 * The filter panel and the table's column filters are two views of the same
 * state, and that state is the URL — so a range picked above and a status
 * picked in the column header cannot drift apart, and the whole report is
 * shareable and survives a reload.
 *
 * Written once and shared rather than copied into both, because the page reset
 * below is the kind of rule that gets fixed in one copy and not the other.
 */
export function useComplianceFilters(slug: string) {
  const router = useRouter();
  const params = useSearchParams();

  function update(changes: Record<string, string | undefined>) {
    const next = new URLSearchParams(params.toString());

    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }

    /*
     * Narrowing the results returns you to the first page.
     *
     * Without this, someone on page 4 who then filtered to a single checklist
     * stayed on page 4 of a result that now had one page — an empty table
     * reading "No submissions match these filters", which is a lie about the
     * filters rather than a fact about the data. Paging itself is exempt, or
     * every Next click would bounce back to the start.
     */
    if (!('page' in changes)) next.delete('page');

    const query = next.toString();
    router.push(`/dashboard/boards/${slug}/compliance${query ? `?${query}` : ''}`);
  }

  return { params, update };
}

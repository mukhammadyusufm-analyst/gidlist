'use client';

import { useActionState, useState } from 'react';
import { ChevronRight, MapPin } from 'lucide-react';
import { CHECKLIST_TEMPLATES, templateNeedsPlace, templateText } from '@app/core';

import { createChecklistFromTemplate, type ActionState } from '@/lib/checklists/actions';
import { LocationPicker } from '@/components/checklists/location-picker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormNotice } from '@/components/ui/field-error';
import { useT } from '@/components/i18n/provider';

const initialState: ActionState = {};

/**
 * The ready-made checklists, one tap each.
 *
 * One form with a submit button per template: the button's own name/value is
 * what says which template was chosen, so there is no client state to keep.
 *
 * Except for templates held to a workplace (attendance): those open a small
 * panel asking where, because the database will not hold a location rule
 * without a place, and a template cannot know anybody's address.
 */
export function TemplatePicker({ boardId, slug }: { boardId: string; slug: string }) {
  const [state, action, pending] = useActionState(createChecklistFromTemplate, initialState);
  const { t, locale } = useT();
  const [placing, setPlacing] = useState<string | null>(null);
  const [place, setPlace] = useState({ lat: '', lng: '' });
  const [radius, setRadius] = useState('150');

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="boardId" value={boardId} />
      <input type="hidden" name="slug" value={slug} />

      <ul className="divide-y divide-[var(--color-border)] overflow-hidden rounded-lg border border-[var(--color-border)]">
        {CHECKLIST_TEMPLATES.map((template) => {
          const needsPlace = templateNeedsPlace(template);
          const open = placing === template.key;
          return (
            <li key={template.key}>
              <button
                type={needsPlace ? 'button' : 'submit'}
                name={needsPlace ? undefined : 'template'}
                value={needsPlace ? undefined : template.key}
                onClick={needsPlace ? () => setPlacing(open ? null : template.key) : undefined}
                aria-expanded={needsPlace ? open : undefined}
                disabled={pending}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[var(--color-accent)] focus-visible:bg-[var(--color-accent)] focus-visible:outline-none disabled:opacity-50"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    {templateText(template.title, locale)}
                    {needsPlace ? (
                      <MapPin className="size-3.5 shrink-0 text-[var(--color-muted-foreground)]" aria-hidden="true" />
                    ) : null}
                  </span>
                  <span className="block text-sm text-[var(--color-muted-foreground)]">
                    {templateText(template.description, locale)}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-[var(--color-muted-foreground)] tabular-nums">
                  {t('checklist.templateItems', { n: template.items.length })}
                </span>
                <ChevronRight
                  className={`size-4 shrink-0 text-[var(--color-muted-foreground)] transition-transform ${open ? 'rotate-90' : ''}`}
                  aria-hidden="true"
                />
              </button>

              {open ? (
                <div className="space-y-3 border-t border-[var(--color-border)] bg-[var(--color-muted)]/40 px-3 py-3">
                  <input type="hidden" name="placeLat" value={place.lat} />
                  <input type="hidden" name="placeLng" value={place.lng} />

                  <div>
                    <p className="text-sm font-medium">{t('checklist.templatePlaceTitle')}</p>
                    <p className="text-sm text-[var(--color-muted-foreground)]">
                      {t('checklist.templatePlaceHint')}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-end gap-3">
                    <label className="block space-y-1">
                      <span className="block text-sm">{t('checklist.templatePlaceRadius')}</span>
                      <Input
                        name="placeRadius"
                        type="number"
                        inputMode="numeric"
                        min={25}
                        max={5000}
                        value={radius}
                        onChange={(e) => setRadius(e.target.value)}
                        className="w-32"
                      />
                    </label>
                    <LocationPicker
                      lat={place.lat}
                      lng={place.lng}
                      radius={radius}
                      onPick={(next) => setPlace(next)}
                    />
                  </div>

                  {place.lat ? (
                    <p className="text-sm text-[var(--color-muted-foreground)] tabular-nums">
                      {t('checklist.templatePlaceChosen', { lat: place.lat, lng: place.lng })}
                    </p>
                  ) : null}

                  <Button
                    type="submit"
                    name="template"
                    value={template.key}
                    disabled={pending || !place.lat}
                  >
                    {t('checklist.templateCreate')}
                  </Button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {state.formError ? <FormNotice kind="error">{state.formError}</FormNotice> : null}
    </form>
  );
}

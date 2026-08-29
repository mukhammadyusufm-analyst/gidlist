'use client';

import { useActionState, useOptimistic, useRef, useState, useTransition } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { canNestUnder, MAX_ITEM_DEPTH, type ItemNode } from '@app/core';

import {
  addGroup,
  addItem,
  deleteGroup,
  deleteItem,
  updateItem,
  renameGroup,
  reorderGroups,
  reorderItems,
} from '@/lib/checklists/actions';
import type { ChecklistItem } from '@/lib/supabase/database.types';
import type { GroupWithItems } from '@/lib/checklists/queries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useT } from '@/components/i18n/provider';
import { cn } from '@/lib/utils';

type Item = ItemNode<ChecklistItem>;

/**
 * Shared drag sensors.
 *
 * A distance threshold keeps a tap on a button from registering as a drag, and
 * the touch delay stops a drag from fighting with page scrolling on a phone.
 * The keyboard sensor means reordering is not mouse-only.
 */
function useDragSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
}

export function ChecklistBuilder({
  versionId,
  groups,
  editable,
}: {
  versionId: string;
  groups: GroupWithItems[];
  editable: boolean;
}) {
  const sensors = useDragSensors();
  const [, startTransition] = useTransition();

  /**
   * `useOptimistic` rather than mirroring props into `useState`.
   *
   * The earlier version synced local state only when the top-level ids changed.
   * Adding a sub-item changes nothing at the top level, so the list kept stale
   * copies of its items and the new sub-item — saved correctly in the database
   * — was never rendered. useOptimistic snaps back to the server's data as soon
   * as the transition settles, so that class of bug cannot recur.
   */
  const [optimisticGroups, setOptimisticGroups] = useOptimistic(
    groups,
    (_current, next: GroupWithItems[]) => next,
  );

  function handleGroupDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = optimisticGroups.findIndex((g) => g.id === active.id);
    const newIndex = optimisticGroups.findIndex((g) => g.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const next = arrayMove(optimisticGroups, oldIndex, newIndex);

    startTransition(async () => {
      setOptimisticGroups(next);
      await reorderGroups(
        versionId,
        next.map((g) => g.id),
      );
    });
  }

  return (
    <div className="space-y-6">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleGroupDragEnd}
      >
        <SortableContext
          items={optimisticGroups.map((g) => g.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-6">
            {optimisticGroups.map((group) => (
              <SortableGroup
                key={group.id}
                versionId={versionId}
                group={group}
                editable={editable}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {editable ? <AddGroupForm versionId={versionId} /> : null}
    </div>
  );
}

function SortableGroup({
  versionId,
  group,
  editable,
}: {
  versionId: string;
  group: GroupWithItems;
  editable: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: group.id,
    disabled: !editable,
  });
  const { t } = useT();

  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-xl border border-[var(--color-border)] ${isDragging ? 'opacity-50' : ''}`}
    >
      <header className="flex items-center gap-2 border-b border-[var(--color-border)] px-3 py-2.5">
        {editable ? (
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={t('checklist.reorderSection', { name: group.title })}
            className="cursor-grab touch-none px-1 text-[var(--color-muted-foreground)]"
          >
            ⠿
          </button>
        ) : null}

        {editable ? (
          <GroupTitleForm groupId={group.id} title={group.title} />
        ) : (
          <h3 className="flex-1 font-medium">{group.title}</h3>
        )}

        {editable ? (
          <form action={async (fd: FormData) => void (await deleteGroup({}, fd))}>
            <input type="hidden" name="groupId" value={group.id} />
            <Button type="submit" variant="ghost" size="sm">
              {t('common.delete')}
            </Button>
          </form>
        ) : null}
      </header>

      <div className="p-2">
        {group.items.length === 0 ? (
          <p className="px-2 py-3 text-sm text-[var(--color-muted-foreground)]">
            {t('checklist.noItems')}
          </p>
        ) : (
          <ItemList versionId={versionId} items={group.items} editable={editable} />
        )}
      </div>

      {editable ? (
        <div className="border-t border-[var(--color-border)] p-3">
          <AddItemForm
            versionId={versionId}
            groupId={group.id}
            parentItemId={null}
            label={t('checklist.addItem')}
          />
        </div>
      ) : null}
    </section>
  );
}

/** Section name, saved when the field loses focus or Enter is pressed. */
function GroupTitleForm({ groupId, title }: { groupId: string; title: string }) {
  const { t } = useT();

  return (
    <form
      action={async (fd: FormData) => void (await renameGroup({}, fd))}
      className="flex-1"
    >
      <input type="hidden" name="groupId" value={groupId} />
      <input
        name="title"
        defaultValue={title}
        aria-label={t('checklist.sectionName')}
        // Submitting on blur avoids a Save button on every section. The guard
        // stops a pointless write when the name was not actually changed.
        onBlur={(e) => {
          if (e.currentTarget.value.trim() !== title) e.currentTarget.form?.requestSubmit();
        }}
        className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 font-medium hover:border-[var(--color-border)] focus:border-[var(--color-ring)] focus:outline-none"
      />
    </form>
  );
}

/** One level of siblings. Recurses for sub-items. */
function ItemList({
  versionId,
  items,
  editable,
}: {
  versionId: string;
  items: Item[];
  editable: boolean;
}) {
  const sensors = useDragSensors();
  const [, startTransition] = useTransition();
  const [optimisticItems, setOptimisticItems] = useOptimistic(
    items,
    (_current, next: Item[]) => next,
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = optimisticItems.findIndex((i) => i.id === active.id);
    const newIndex = optimisticItems.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const next = arrayMove(optimisticItems, oldIndex, newIndex);

    startTransition(async () => {
      setOptimisticItems(next);
      await reorderItems(
        versionId,
        next.map((i) => i.id),
      );
    });
  }

  return (
    // Each sibling list owns its own context: a level-3 sub-task has no valid
    // drop position among top-level items, and nesting contexts makes both
    // behave erratically.
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext
        items={optimisticItems.map((i) => i.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul className="space-y-1">
          {optimisticItems.map((item) => (
            <SortableItem key={item.id} versionId={versionId} item={item} editable={editable} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableItem({
  versionId,
  item,
  editable,
}: {
  versionId: string;
  item: Item;
  editable: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: !editable,
  });

  const [showAdd, setShowAdd] = useState(false);
  // Kept for the requirements panel below, which surfaces save errors instead of
  // discarding them the way the rest of this builder does.
  const [evidenceState] = useActionState(updateItem, {});
  const { t } = useT();
  const canNest = canNestUnder(item.depth);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? 'opacity-50' : undefined}
    >
      <div className="flex items-start gap-2 rounded-md px-2 py-2 hover:bg-[var(--color-accent)]">
        {editable ? (
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={t('checklist.reorderItem', { name: item.title })}
            className="mt-0.5 cursor-grab touch-none px-1 text-[var(--color-muted-foreground)]"
          >
            ⠿
          </button>
        ) : null}

        <div className="min-w-0 flex-1">
          <p className="font-medium">{item.title}</p>
          {item.description ? (
            <p className="text-sm text-[var(--color-muted-foreground)]">{item.description}</p>
          ) : null}
        </div>

        {editable ? (
          <div className="flex shrink-0 items-center gap-1">
            {canNest ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowAdd((v) => !v)}>
                {t('checklist.addSubItem')}
              </Button>
            ) : (
              <span className="px-2 text-xs text-[var(--color-muted-foreground)]">
                {t('checklist.maxDepth', { n: MAX_ITEM_DEPTH })}
              </span>
            )}
            <form action={async (fd: FormData) => void (await deleteItem({}, fd))}>
              <input type="hidden" name="itemId" value={item.id} />
              <Button type="submit" variant="ghost" size="sm">
                {t('common.delete')}
              </Button>
            </form>
          </div>
        ) : null}
      </div>

      {/*
        Requirements live on their own row, below the item, because they are
        settings rather than content — and because a leaf item is the only place
        they mean anything. A parent completes by rollup, so a rule on it would
        have no moment at which anybody could satisfy it; the database exempts
        parents and the interface does not offer them the choice.
      */}
      {editable && item.children.length === 0 ? (
        <ItemRequirements item={item} evidenceState={evidenceState} />
      ) : null}

      {evidenceState.formError ? (
        <p className="px-2 pb-2 text-xs text-[var(--color-destructive)]">
          {evidenceState.formError}
        </p>
      ) : null}

      {item.children.length > 0 || showAdd ? (
        // Indentation is the only cue for nesting, so it has to read clearly
        // without pushing level-5 items off the side of a phone screen.
        <div className="ml-5 border-l border-[var(--color-border)] pl-3">
          {item.children.length > 0 ? (
            <ItemList versionId={versionId} items={item.children} editable={editable} />
          ) : null}

          {showAdd ? (
            <div className="py-2">
              <AddItemForm
                versionId={versionId}
                groupId={item.group_id}
                parentItemId={item.id}
                label={t('checklist.add')}
                onDone={() => setShowAdd(false)}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function AddItemForm({
  versionId,
  groupId,
  parentItemId,
  label,
  onDone,
}: {
  versionId: string;
  groupId: string | null;
  parentItemId: string | null;
  label: string;
  onDone?: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const { t } = useT();

  return (
    <form
      ref={formRef}
      action={async (formData: FormData) => {
        await addItem({}, formData);
        // React only auto-resets a form when the server action is passed
        // directly as `action`. This one is wrapped, so the reset is explicit —
        // otherwise the previous title stays in the box and adding several
        // items in a row means clearing it by hand every time.
        formRef.current?.reset();
        onDone?.();
      }}
      className="flex gap-2"
    >
      <input type="hidden" name="versionId" value={versionId} />
      <input type="hidden" name="groupId" value={groupId ?? ''} />
      <input type="hidden" name="parentItemId" value={parentItemId ?? ''} />
      <Input
        name="title"
        required
        placeholder={t('checklist.itemPlaceholder')}
        className="flex-1"
      />
      <Button type="submit" size="sm">
        {label}
      </Button>
    </form>
  );
}

function AddGroupForm({ versionId }: { versionId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const { t } = useT();

  return (
    <form
      ref={formRef}
      action={async (fd: FormData) => {
        await addGroup({}, fd);
        formRef.current?.reset();
      }}
      className="flex gap-2"
    >
      <input type="hidden" name="versionId" value={versionId} />
      <Input
        name="title"
        required
        placeholder={t('checklist.newSectionName')}
        className="flex-1"
      />
      <Button type="submit" variant="outline">
        {t('checklist.addSection')}
      </Button>
    </form>
  );
}

/**
 * The two conditions an item can carry: a required attachment, and a place.
 *
 * Behind a disclosure rather than always open, because most items have neither
 * and a builder where every row carries six inputs is unreadable. The summary
 * says which are set, so nothing is hidden — only folded.
 *
 * The coordinate fields are numbers rather than a map. A map is the better
 * interface and a much larger one; "use where I am now" covers the common case,
 * which is somebody standing in the place they are describing.
 */
function ItemRequirements({
  item,
  evidenceState,
}: {
  item: Item;
  evidenceState: { fieldErrors?: Record<string, string[]> };
}) {
  const { t } = useT();
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Held in state rather than read from the DOM so the required checkbox can
  // enable and disable as its feature is switched on and off.
  const [photoEnabled, setPhotoEnabled] = useState(item.photo_enabled);
  const [fileEnabled, setFileEnabled] = useState(item.file_enabled);
  const [locationEnabled, setLocationEnabled] = useState(item.location_enabled);

  const summary = [
    item.photo_enabled
      ? t(item.photo_required ? 'checklist.photoRequired' : 'checklist.photoOn')
      : null,
    item.file_enabled
      ? t(item.file_required ? 'checklist.fileRequired' : 'checklist.fileOn')
      : null,
    item.location_enabled
      ? t(item.location_required ? 'checklist.requiresLocation' : 'checklist.recordsLocation')
      : null,
  ].filter((v): v is string => v !== null);

  function useCurrentPosition() {
    if (!('geolocation' in navigator)) {
      setLocationError(t('checklist.locationUnsupported'));
      return;
    }

    setLocationError(null);
    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const form = formRef.current;
        if (!form) return;

        // Six decimal places is about 0.1m — far finer than any consumer GPS,
        // and short enough to read.
        (form.elements.namedItem('locationLat') as HTMLInputElement).value =
          pos.coords.latitude.toFixed(6);
        (form.elements.namedItem('locationLng') as HTMLInputElement).value =
          pos.coords.longitude.toFixed(6);

        const radius = form.elements.namedItem('locationRadiusM') as HTMLInputElement;
        // Seed a sensible radius rather than leaving it blank and failing
        // validation. 50m is generous enough to survive a poor indoor fix.
        if (!radius.value) radius.value = '50';
      },
      () => {
        setLocating(false);
        setLocationError(t('checklist.locationDenied'));
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  }

  return (
    <details className="px-2 pb-2">
      <summary className="cursor-pointer text-xs text-[var(--color-muted-foreground)]">
        {t('checklist.requirements')}
        {/* Each enabled feature listed, and marked when it is also enforced.
            Required and merely recorded are different states, and somebody
            scanning the builder should not have to open every item to tell
            them apart. */}
        {summary.length > 0 ? (
          <span className="ml-1.5 text-[var(--color-primary)]">{summary.join(' · ')}</span>
        ) : null}
      </summary>

      <form
        ref={formRef}
        action={async (fd: FormData) => void (await updateItem({}, fd))}
        className="mt-2 space-y-3 rounded-md border border-[var(--color-border)] p-3"
      >
        <input type="hidden" name="itemId" value={item.id} />
        <input type="hidden" name="title" value={item.title} />
        <input type="hidden" name="description" value={item.description ?? ''} />

        {/* Photo and file are independent, not alternatives — an item can want
            a photograph of the fridge and a signed delivery note. Each has its
            own on switch and its own enforcement, and "required" is disabled
            until the feature is on, because enforcing something switched off is
            a rule with nothing to apply to. */}
        <RequirementToggle
          label={t('checklist.photo')}
          enabledName="photoEnabled"
          requiredName="photoRequired"
          enabled={photoEnabled}
          onEnabledChange={setPhotoEnabled}
          defaultRequired={item.photo_required}
        />

        <RequirementToggle
          label={t('checklist.file')}
          enabledName="fileEnabled"
          requiredName="fileRequired"
          enabled={fileEnabled}
          onEnabledChange={setFileEnabled}
          defaultRequired={item.file_required}
        />

        <div>
          <RequirementToggle
            label={t('checklist.locationTitle')}
            enabledName="locationEnabled"
            requiredName="locationRequired"
            enabled={locationEnabled}
            onEnabledChange={setLocationEnabled}
            defaultRequired={item.location_required}
          />
          <div className="grid grid-cols-3 gap-2">
            <Input
              name="locationLat"
              defaultValue={item.location_lat ?? ''}
              placeholder={t('checklist.latitude')}
              aria-label={t('checklist.latitude')}
              inputMode="decimal"
            />
            <Input
              name="locationLng"
              defaultValue={item.location_lng ?? ''}
              placeholder={t('checklist.longitude')}
              aria-label={t('checklist.longitude')}
              inputMode="decimal"
            />
            <Input
              name="locationRadiusM"
              defaultValue={item.location_radius_m ?? ''}
              placeholder={t('checklist.radius')}
              aria-label={t('checklist.radius')}
              inputMode="numeric"
            />
          </div>

          {/* Said plainly, because a radius chosen without knowing this will be
              too tight and the feature will look broken. */}
          <p className="mt-1.5 text-xs text-[var(--color-muted-foreground)]">
            {t('checklist.locationAccuracyNote')}
          </p>

          {locationError ? (
            <p className="mt-1 text-xs text-[var(--color-destructive)]">{locationError}</p>
          ) : null}

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={useCurrentPosition}
            disabled={locating}
          >
            {locating ? t('checklist.locating') : t('checklist.useMyLocation')}
          </Button>
        </div>

        {evidenceState.fieldErrors?.locationRadiusM ? (
          <p className="text-xs text-[var(--color-destructive)]">
            {evidenceState.fieldErrors.locationRadiusM[0]}
          </p>
        ) : null}

        <Button type="submit" size="sm">
          {t('common.save')}
        </Button>
      </form>
    </details>
  );
}

/**
 * One feature, with its two switches.
 *
 * Enabled and required are separate decisions and neither implies the other —
 * an item can demand a photograph while merely inviting a file, and record a
 * location without insisting on it. Required is disabled until the feature is
 * on, because enforcing something switched off is a rule with nothing to apply
 * to; the database refuses that combination too.
 *
 * Enabled is held in state rather than read from the DOM so the required
 * checkbox can grey out the moment its feature is switched off, instead of
 * waiting for a save to tell somebody the combination was invalid.
 */
function RequirementToggle({
  label,
  enabledName,
  requiredName,
  enabled,
  onEnabledChange,
  defaultRequired,
}: {
  label: string;
  enabledName: string;
  requiredName: string;
  enabled: boolean;
  onEnabledChange: (next: boolean) => void;
  defaultRequired: boolean;
}) {
  const { t } = useT();

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          name={enabledName}
          checked={enabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
          className="size-4"
        />
        {label}
      </label>

      <label
        className={cn(
          'flex items-center gap-2 text-sm',
          enabled ? '' : 'text-[var(--color-muted-foreground)]',
        )}
      >
        <input
          type="checkbox"
          name={requiredName}
          defaultChecked={defaultRequired}
          disabled={!enabled}
          className="size-4"
        />
        {t('checklist.enforced')}
      </label>
    </div>
  );
}

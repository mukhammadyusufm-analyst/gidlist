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
  const [evidenceState, evidenceAction] = useActionState(updateItem, {});
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
            {/*
              Evidence sits on the row rather than behind an edit screen,
              because there is no item edit screen — items are added, reordered
              and deleted, and nothing else. A select that submits on change is
              the smallest thing that makes this reachable.

              `title` and `description` ride along as hidden fields because
              `updateItem` validates the whole item; sending only the evidence
              would blank the title.
            */}
            {/* The result is kept, not discarded. Every other form in this
                builder throws it away with `void (await …)`, which is why a
                failed save here looked like the selector silently snapping back
                to "No attachment" — the write was refused and nothing said so. */}
            <form action={evidenceAction}>
              <input type="hidden" name="itemId" value={item.id} />
              <input type="hidden" name="title" value={item.title} />
              <input type="hidden" name="description" value={item.description ?? ''} />
              <select
                name="evidence"
                // Keyed on the saved value so a refused save visibly reverts
                // rather than leaving the control showing something the
                // database does not hold.
                key={item.evidence}
                defaultValue={item.evidence}
                onChange={(e) => e.currentTarget.form?.requestSubmit()}
                aria-label={t('checklist.evidenceLabel')}
                className="rounded-md border border-[var(--color-input)] bg-transparent px-2 py-1 text-xs"
              >
                <option value="none">{t('checklist.evidenceNone')}</option>
                <option value="photo">{t('checklist.evidencePhoto')}</option>
                <option value="file">{t('checklist.evidenceFile')}</option>
              </select>
            </form>

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

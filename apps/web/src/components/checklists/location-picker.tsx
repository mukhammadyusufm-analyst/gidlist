'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MapPin, Search } from 'lucide-react';
import type { Map as LeafletMap, Circle, Marker } from 'leaflet';

// Leaflet's own stylesheet. Without it the tiles are stacked in a column rather
// than laid out as a map — the panes are absolutely positioned by these rules,
// not by anything the library does in script.
import 'leaflet/dist/leaflet.css';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useT } from '@/components/i18n/provider';

/**
 * Choose the place an item has to be ticked, by looking at it.
 *
 * =============================================================================
 * WHY THIS EXISTS
 *
 * The only way to pin an item to a place was to type its latitude and longitude.
 * That is a reasonable ask of somebody who already has the coordinates and an
 * unreasonable one of everybody else — a manager writing "check the loading bay
 * door" knows exactly where it is and has no idea what number describes it. The
 * feature was effectively limited to people who could find coordinates
 * elsewhere and paste them in, which is not who it is for.
 *
 * =============================================================================
 * WHAT NEEDS A CONNECTION AND WHAT DOES NOT
 *
 * THIS does. Map tiles come off a server, so choosing a location is an
 * authoring task done at a desk, which is where it belongs.
 *
 * TICKING THE ITEM DOES NOT, and that is the part that matters on a shop floor.
 * A position comes from GPS, and satellites need no network — the reading is
 * taken with no signal, carried into the queue with the tick, and judged by the
 * database when it arrives. Nothing on this screen is needed for that.
 *
 * =============================================================================
 * OPENSTREETMAP, NOT GOOGLE
 *
 * No key, no billing account, no per-load charge that turns into a bill if the
 * product does well. The tiles are attributed as their licence requires, and
 * search goes through Nominatim only when somebody presses the button — never
 * per keystroke, which their usage policy asks for and which also stops a
 * half-typed street name from firing twenty requests.
 */
export function LocationPicker({
  lat,
  lng,
  radius,
  onPick,
}: {
  /** Current values, as typed in the fields. Empty when nothing is set yet. */
  lat: string;
  lng: string;
  radius: string;
  onPick: (next: { lat: string; lng: string }) => void;
}) {
  const { t } = useT();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-3 ml-2"
        onClick={() => setOpen(true)}
      >
        <MapPin className="size-4" aria-hidden="true" />
        {t('checklist.pickOnMap')}
      </Button>

      {/*
        Mounted only while open, so Leaflet is not loaded by everybody editing a
        checklist that has nothing to do with location — it is the largest thing
        on this page by a wide margin.
      */}
      {open ? (
        <PickerDialog
          lat={lat}
          lng={lng}
          radius={radius}
          onClose={() => setOpen(false)}
          onPick={(next) => {
            onPick(next);
            setOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

/** Tashkent, as a last resort. Somewhere is a better start than nowhere. */
const FALLBACK: [number, number] = [41.2995, 69.2401];

function PickerDialog({
  lat,
  lng,
  radius,
  onClose,
  onPick,
}: {
  lat: string;
  lng: string;
  radius: string;
  onClose: () => void;
  onPick: (next: { lat: string; lng: string }) => void;
}) {
  const { t } = useT();
  const ref = useRef<HTMLDialogElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const ring = useRef<Circle | null>(null);

  const [point, setPoint] = useState<[number, number]>(() => {
    const a = Number(lat);
    const b = Number(lng);
    return Number.isFinite(a) && Number.isFinite(b) && lat !== '' && lng !== ''
      ? [a, b]
      : FALLBACK;
  });

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [noResult, setNoResult] = useState(false);

  // `showModal` rather than the `open` attribute: it is what gives the dialog
  // focus containment, Escape, and the backdrop, none of which is worth
  // reimplementing.
  useEffect(() => {
    ref.current?.showModal();
  }, []);

  /*
   * Leaflet is imported here rather than at the top of the file.
   *
   * It touches `window` as it initialises, so a static import would break the
   * server render of every page that reaches this component. The dynamic import
   * also means the library is fetched when somebody opens the map and not
   * before.
   */
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !host.current || map.current) return;

      const instance = L.map(host.current).setView(point, lat && lng ? 17 : 12);

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        // Required by the tile licence, and shown on the map itself.
        attribution: '© OpenStreetMap',
      }).addTo(instance);

      /*
       * A div icon, not Leaflet's default marker.
       *
       * The default one points at two PNGs by a relative path that no bundler
       * rewrites, so it renders as a broken image in every build. An inline
       * element sidesteps the problem entirely and themes itself.
       */
      const icon = L.divIcon({
        className: '',
        html: '<div style="width:18px;height:18px;border-radius:9999px;background:#3b6fd4;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.5)"></div>',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });

      marker.current = L.marker(point, { icon, draggable: true }).addTo(instance);
      ring.current = L.circle(point, {
        radius: Number(radius) || 100,
        color: '#3b6fd4',
        weight: 1,
        fillOpacity: 0.12,
      }).addTo(instance);

      const move = (next: [number, number]) => {
        setPoint(next);
        marker.current?.setLatLng(next);
        ring.current?.setLatLng(next);
      };

      instance.on('click', (e) => move([e.latlng.lat, e.latlng.lng]));
      marker.current.on('dragend', () => {
        const p = marker.current!.getLatLng();
        move([p.lat, p.lng]);
      });

      map.current = instance;

      /*
       * Leaflet measures its container on creation, and this one is inside a
       * dialog that has just been shown — so the first measurement can be of a
       * box that is still zero high, leaving a grey rectangle. Asking for a
       * re-measure on the next frame is the standard remedy.
       */
      requestAnimationFrame(() => instance.invalidateSize());
    })();

    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
    // Deliberately once: this sets the map up, and every later change is pushed
    // through the refs above rather than by rebuilding it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The radius is edited in the field behind this dialog, so the ring follows
  // it — the whole point of drawing it is to show what that number covers.
  useEffect(() => {
    ring.current?.setRadius(Number(radius) || 100);
  }, [radius]);

  const search = useCallback(async () => {
    const q = query.trim();
    if (!q) return;

    setSearching(true);
    setNoResult(false);

    try {
      const url = new URL('https://nominatim.openstreetmap.org/search');
      url.searchParams.set('format', 'json');
      url.searchParams.set('limit', '1');
      url.searchParams.set('q', q);

      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      const results: unknown = await response.json();
      const first = Array.isArray(results) ? results[0] : null;

      if (!first || typeof first !== 'object') {
        setNoResult(true);
        return;
      }

      const found = first as { lat?: string; lon?: string };
      const next: [number, number] = [Number(found.lat), Number(found.lon)];
      if (!Number.isFinite(next[0]) || !Number.isFinite(next[1])) {
        setNoResult(true);
        return;
      }

      setPoint(next);
      marker.current?.setLatLng(next);
      ring.current?.setLatLng(next);
      map.current?.setView(next, 17);
    } catch {
      // A search that cannot reach the service is not an error worth a banner:
      // the map still works and the marker can still be dragged.
      setNoResult(true);
    } finally {
      setSearching(false);
    }
  }, [query]);

  /*
   * PORTALLED TO THE BODY, WHICH IS NOT A DETAIL.
   *
   * This component is rendered deep inside the checklist builder's <form>. A
   * dialog left there is still part of that form, so its search field is a text
   * input in it — and a text input in a form submits the form on Enter, which
   * here means saving a half-edited item because somebody pressed Go on their
   * phone keyboard while looking for a street.
   *
   * `preventDefault` on the keydown covers that too, and did not fire when it
   * was tested, which is the whole argument for not relying on it. Moving the
   * dialog out of the form removes the hazard rather than handling it.
   */
  return createPortal(
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        // Clicking the backdrop closes it. The dialog element reports those
        // clicks as landing on itself, which is the only way to tell them from
        // a click on the contents.
        if (e.target === ref.current) ref.current?.close();
      }}
      className="m-auto w-[min(44rem,92vw)] rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-0 text-[var(--color-foreground)] backdrop:bg-black/50"
    >
      <div className="space-y-3 p-4">
        <h2 className="text-sm font-semibold">{t('checklist.pickOnMap')}</h2>

        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('checklist.searchPlace')}
            onKeyDown={(e) => {
              // Enter searches. Without this it submits the checklist form
              // behind the dialog, which saves a half-finished item.
              if (e.key === 'Enter') {
                e.preventDefault();
                void search();
              }
            }}
          />
          <Button type="button" variant="outline" onClick={() => void search()} disabled={searching}>
            <Search className="size-4" aria-hidden="true" />
            {t('common.search')}
          </Button>
        </div>

        {noResult ? (
          <p className="text-xs text-[var(--color-muted-foreground)]">
            {t('checklist.searchNothing')}
          </p>
        ) : null}

        <div
          ref={host}
          className="h-[min(60vh,26rem)] w-full overflow-hidden rounded-lg border border-[var(--color-border)]"
        />

        <p className="text-xs text-[var(--color-muted-foreground)]">
          {t('checklist.mapHint')}
        </p>

        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-xs text-[var(--color-muted-foreground)] tabular-nums">
            {point[0].toFixed(6)}, {point[1].toFixed(6)}
          </span>

          <span className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => ref.current?.close()}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              onClick={() =>
                // Six decimals is about 11 cm. More is noise from a phone's GPS
                // and only makes the field harder to read.
                onPick({ lat: point[0].toFixed(6), lng: point[1].toFixed(6) })
              }
            >
              {t('common.save')}
            </Button>
          </span>
        </div>
      </div>
    </dialog>,
    document.body,
  );
}

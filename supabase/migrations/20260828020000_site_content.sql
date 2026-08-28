-- =============================================================================
-- Editable marketing copy
--
-- Phase C of the marketing site. Lets the wording on gidlist.com change without
-- a code edit and a deploy.
--
-- DELIBERATELY THE SAME SHAPE AS `translations`, not a new idea. That table
-- already solves this exact problem for the product's interface: per-string
-- overrides layered on top of a catalogue shipped in the bundle. Copying the
-- pattern means the fallback behaviour, the RLS shape and the admin screen all
-- work the way somebody familiar with this codebase already expects.
--
-- Two properties matter more than anything else here:
--
--   1. OVERRIDES, NOT CONTENT. A row replaces one string. The site ships with
--      complete copy in all three languages in `messages.ts`, so an empty table
--      renders a complete page. A database outage degrades to the bundled copy
--      rather than to a blank site — which is the difference between a slow day
--      and a dead shopfront.
--
--   2. DELETING AN OVERRIDE IS THE UNDO. There is no "restore original" button
--      to build and no original to hunt for: remove the row and the bundled
--      string comes back.
--
-- Why not a headless CMS: it would be a fourth vendor holding content, a second
-- access model to reason about, and a second thing to be down. This is one
-- table with three columns.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- A capability of its own, separate from `translations`.
--
-- Public marketing copy and in-product wording are different jobs with
-- different blast radii: a bad translation confuses a customer who is already
-- paying, a bad headline is on the front page for everyone including the press.
-- Somebody trusted to fix a button label has not thereby been trusted to
-- rewrite the pitch, and the capability model exists precisely so that these
-- can be handed out separately.
-- -----------------------------------------------------------------------------
insert into public.platform_capabilities (code, name, description, is_root, sort_order)
values
  ('site', 'Marketing site',
   'Edit the wording on the public website.', false, 3)
on conflict (code) do nothing;

-- -----------------------------------------------------------------------------
-- site_content
-- -----------------------------------------------------------------------------
create table if not exists public.site_content (
  id         uuid primary key default gen_random_uuid(),
  /*
   * Locale is a plain check, not a reference to `app_locales`.
   *
   * `app_locales` is the set of languages the *product* offers, and an
   * administrator can add one there at will. The site has exactly three, each
   * with hand-written copy, a route and an hreflang entry — adding a fourth is
   * a code change whatever this column says. A foreign key would imply the site
   * follows the product's language list, which it does not.
   */
  locale     text not null check (locale in ('en', 'uz', 'ru')),
  key        text not null check (key ~ '^[a-zA-Z][a-zA-Z0-9_.]{1,80}$'),
  value      text not null check (length(value) <= 4000),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

comment on table public.site_content is
  'Per-string overrides for gidlist.com, layered over the copy shipped in apps/site. No row means the bundled string is used.';

comment on column public.site_content.key is
  'Dotted path into the site message catalogue, e.g. headline or features.0.title. Must match a key that exists in the bundle; an unknown key is ignored at render.';

create unique index if not exists site_content_locale_key_idx
  on public.site_content (locale, key);

-- The read path is "every override for one locale", fetched once per page
-- render. This is the index that matters.
create index if not exists site_content_locale_idx on public.site_content (locale);

drop trigger if exists site_content_set_updated_at on public.site_content;
create trigger site_content_set_updated_at
  before update on public.site_content
  for each row execute function public.set_updated_at();

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.site_content enable row level security;

-- Readable by everyone, signed out included. This is the text on a public
-- marketing page; the anonymous key is what the site reads it with.
drop policy if exists site_content_read on public.site_content;
create policy site_content_read on public.site_content
  for select to public using (true);

drop policy if exists site_content_write on public.site_content;
create policy site_content_write on public.site_content
  for all to authenticated
  using (public.has_platform_capability('site'))
  with check (public.has_platform_capability('site'));

commit;

notify pgrst, 'reload schema';

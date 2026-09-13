-- RUN THIS IN: BOTH databases, one after the other, and compare the results.
--
--   gidlist-dev    zffoidgzuyhojnydshkq
--   production     ivqprkzqnoiffqlbfkkd
--
-- Confirm which one you are in by the project ref in the ADDRESS BAR, not by the
-- breadcrumb — the breadcrumb badges dev as PRODUCTION.
--
-- READ-ONLY. Nothing here changes anything, in either database. Safe to run at
-- any time, as often as you like.
--
-- =============================================================================
-- WHY THIS EXISTS
--
-- Migrations reach production by hand, pasted into its SQL editor. So the two
-- databases can drift in either direction, silently: a migration run in one and
-- forgotten in the other, or run in both from different versions of the same
-- file. Neither database errors when that happens — the app simply behaves
-- differently in each, and the difference looks like a bug in the code.
--
-- Checking "did migration X run" is not enough, because a function can exist in
-- both with DIFFERENT BODIES — a later `create or replace` applied to only one
-- side. So this compares what is actually there, object by object, with a hash
-- of each object's definition.
--
-- Two details keep it from crying wolf:
--   * whitespace inside definitions is collapsed before hashing, so a migration
--     pasted from a file with Windows line endings matches the same migration
--     applied from the repository;
--   * objects owned by extensions are left out, so an extension's version is not
--     reported as our drift.
--
-- It is kept in the repository as a standing check: run it before every release
-- that carries a migration.
-- =============================================================================


-- ===================================================================
-- PART 1 — RUN THIS FIRST, IN BOTH DATABASES.
--
-- About seven rows. If every row's `objects` and `fingerprint` match
-- between the two databases, they are identical and you are done.
--
-- If any row differs, note which category, and run PART 2 below.
-- ===================================================================

with
functions as (
  select 'functions'::text as category,
         p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as object,
         md5(regexp_replace(pg_get_functiondef(p.oid), '\s+', ' ', 'g')) as hash
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.prokind in ('f', 'p')
     and not exists (
       select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e'
     )
),
columns as (
  select 'columns'::text,
         c.table_name || '.' || c.column_name,
         md5(concat_ws('|', c.data_type, c.is_nullable,
                       regexp_replace(coalesce(c.column_default, ''), '\s+', ' ', 'g')))
    from information_schema.columns c
   where c.table_schema = 'public'
),
triggers as (
  select 'triggers'::text,
         c.relname || '.' || t.tgname,
         md5(pg_get_triggerdef(t.oid))
    from pg_trigger t
    join pg_class c     on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and not t.tgisinternal
),
policies as (
  -- Storage included: who may read an evidence photograph is decided there.
  select 'policies'::text,
         schemaname || '.' || tablename || '.' || policyname,
         md5(concat_ws('|', cmd, array_to_string(roles, ','),
                       regexp_replace(coalesce(qual, ''), '\s+', ' ', 'g'),
                       regexp_replace(coalesce(with_check, ''), '\s+', ' ', 'g')))
    from pg_policies
   where schemaname in ('public', 'storage')
),
indexes as (
  select 'indexes'::text,
         tablename || '.' || indexname,
         md5(indexdef)
    from pg_indexes
   where schemaname = 'public'
),
constraints as (
  select 'constraints'::text,
         conrelid::regclass::text || '.' || conname,
         md5(regexp_replace(pg_get_constraintdef(oid), '\s+', ' ', 'g'))
    from pg_constraint
   where connamespace = 'public'::regnamespace
),
buckets as (
  -- Storage buckets and their limits: a file-size limit set in one database and
  -- not the other shows up as uploads failing in only one of them.
  select 'buckets'::text,
         id,
         md5(concat_ws('|', public::text, coalesce(file_size_limit::text, ''),
                       coalesce(array_to_string(allowed_mime_types, ','), '')))
    from storage.buckets
),
everything as (
  select * from functions
  union all select * from columns
  union all select * from triggers
  union all select * from policies
  union all select * from indexes
  union all select * from constraints
  union all select * from buckets
)
select category,
       count(*)                                                        as objects,
       md5(string_agg(object || '=' || hash, ',' order by object))    as fingerprint
  from everything
 group by category
 order by category;


-- ===================================================================
-- PART 2 — ONLY IF PART 1 SHOWED A DIFFERENCE. RUN IN BOTH DATABASES.
--
-- Every object, one row each. In the Supabase SQL editor, use the
-- results panel's Download → CSV, once in each database, and send me
-- both files. I will diff them and write the migration that brings
-- the lagging side level.
--
-- To look at one category only, uncomment the `where` line at the
-- bottom and set it to the category Part 1 flagged.
-- ===================================================================

/*
with
functions as (
  select 'functions'::text as category,
         p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as object,
         md5(regexp_replace(pg_get_functiondef(p.oid), '\s+', ' ', 'g')) as hash
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.prokind in ('f', 'p')
     and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
),
columns as (
  select 'columns'::text, c.table_name || '.' || c.column_name,
         md5(concat_ws('|', c.data_type, c.is_nullable,
                       regexp_replace(coalesce(c.column_default, ''), '\s+', ' ', 'g')))
    from information_schema.columns c
   where c.table_schema = 'public'
),
triggers as (
  select 'triggers'::text, c.relname || '.' || t.tgname, md5(pg_get_triggerdef(t.oid))
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and not t.tgisinternal
),
policies as (
  select 'policies'::text, schemaname || '.' || tablename || '.' || policyname,
         md5(concat_ws('|', cmd, array_to_string(roles, ','),
                       regexp_replace(coalesce(qual, ''), '\s+', ' ', 'g'),
                       regexp_replace(coalesce(with_check, ''), '\s+', ' ', 'g')))
    from pg_policies
   where schemaname in ('public', 'storage')
),
indexes as (
  select 'indexes'::text, tablename || '.' || indexname, md5(indexdef)
    from pg_indexes
   where schemaname = 'public'
),
constraints as (
  select 'constraints'::text, conrelid::regclass::text || '.' || conname,
         md5(regexp_replace(pg_get_constraintdef(oid), '\s+', ' ', 'g'))
    from pg_constraint
   where connamespace = 'public'::regnamespace
),
buckets as (
  select 'buckets'::text, id,
         md5(concat_ws('|', public::text, coalesce(file_size_limit::text, ''),
                       coalesce(array_to_string(allowed_mime_types, ','), '')))
    from storage.buckets
),
everything as (
  select * from functions
  union all select * from columns
  union all select * from triggers
  union all select * from policies
  union all select * from indexes
  union all select * from constraints
  union all select * from buckets
)
select category, object, hash
  from everything
-- where category = 'functions'
 order by category, object;
*/

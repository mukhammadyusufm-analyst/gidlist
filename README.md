# Checklists

A SaaS app for building, scheduling and tracking operational checklists.

**New here? Read [SETUP.md](SETUP.md) first** — it walks through creating the
Supabase project and getting the app running. [DEPLOY.md](DEPLOY.md) takes it
from there: GitHub, Vercel, your own domain, and email.

---

## Hierarchy

```
Board (a company or department)
└── Checklist (a reusable template)
    └── Group (a section)
        └── Item  (up to 5 levels of sub-items)
```

A parent item completes automatically once all of its children are complete.

## Layout

```
apps/
  web/                  Next.js 16 app — the product and, later, the billing side
packages/
  core/                 Shared domain logic. No React, no Next, no React Native,
                        so the Expo app (Phase 8) can import the same rules.
supabase/
  migrations/           Database schema, applied in order
```

## Commands

Run from the repository root. **On Windows, add `.cmd` to every Node command** —
`pnpm.cmd`, `npx.cmd`, `npm.cmd`. PowerShell's default execution policy blocks
the script-based shims that npm installs, and `.cmd` sidesteps it without
changing any machine-wide security setting.

| Command          | What it does                                  |
| ---------------- | --------------------------------------------- |
| `pnpm dev`       | Start the app at http://localhost:3000        |
| `pnpm build`     | Production build — run before deploying       |
| `pnpm typecheck` | Check types across every package              |
| `pnpm lint`      | Lint                                          |
| `pnpm db:types`  | Regenerate DB types after a schema change     |

## Decisions worth knowing

**Security lives in the database, not the app.** Every table has Row Level
Security policies. A bug in a page, a forged request, or a leaked public key
still cannot read another company's data, because Postgres itself refuses. The
UI is a convenience layer on top of that, never the control.

**Checklist templates are versioned** (from Phase 2). Editing a template in
March must not change what a January submission looked like, or the compliance
history becomes false — and that is not fixable retroactively.

**Scheduled occurrences are materialised ahead of time** (from Phase 3), by a
nightly job that also flips overdue drafts to "Missed". Computing them on the
fly would make the submissions dashboard slow and hard to filter.

**Payments are web-only, by necessity.** Apple and Google require their own
in-app purchase system — and take 15–30% — for subscriptions sold inside an
app. The mobile app therefore has no purchase screen at all: people subscribe
on the web and the app just signs them in. This is the standard B2B approach
and is explicitly permitted.

**"Space" in the interface is `board` in the database.** The product calls these
spaces; the tables are still `boards` and `board_members`. Renaming them would
mean rewriting tables, policies and security functions for something no user
ever sees. The divergence is deliberate.

**Dates never go through `toISOString()`.** It converts to UTC, so in Tashkent
(UTC+5) local midnight becomes 19:00 the previous day — which silently made
"next day" return the same date and the server's "today" return yesterday
before 05:00. Use the helpers in `packages/core/src/dates.ts`, and resolve
"today" through `lib/timezone/server.ts`, which uses the viewer's own timezone.

**Weekday and month names come from `Intl`, not the message catalogue.** Every
locale already knows them, and hard-coding them would need redoing each time an
administrator adds a language in the app.

**Roles split governance from content.** `owner` and `admin` manage people and
space branding; `editor` builds and schedules checklists; `member` fills them
in. Two database functions carry the distinction — `is_board_admin` for
governance, `is_board_editor` for content — kept separate on purpose, because
one function answering two questions is how permissions quietly drift. In app
code use `canGovern()` and `canEditContent()` from `packages/core`, never a
hand-written role comparison.

**The app's address is configuration, not code.** It appears in exactly one
place — `NEXT_PUBLIC_APP_URL` — plus three external settings: the Vercel custom
domain, Supabase's redirect URLs, and the verified sending domain in Resend.
The live address is `app.gidlist.com`; moving it anywhere else is those four
settings and nothing else.

Do **not** host the app on a subfolder (`gidlist.com/app/`). That needs a
reverse proxy plus a Next.js `basePath`, which puts a permanent failure point
between users and the app — and buys nothing, since everything behind the login
is unindexed anyway. The subfolder-for-SEO reasoning applies to marketing pages,
not to the application.

**Email is a notification, never the record.** An invitation lives in the
database and works whether or not a message arrives, so sending is best-effort
and can never fail an invitation. `lib/email/send.ts` is a thin wrapper over the
provider's HTTP API rather than their SDK — swapping provider means editing one
file. It degrades to a no-op when unconfigured, and the UI says which happened.

**App-wide settings are cached across requests; anything personal is not.** The
language list and the translation overrides are read on every page render, and
they change a few times a month — so they go through `unstable_cache` with an
hour's life and a shared tag, cutting two sequential database round trips from
every request in the app. They are read with `createPublicClient()`, a Supabase
client with no session, because a cached function may not touch cookies.

The rule that makes this safe is narrow: **only data whose SELECT policy is
`to public using (true)` may be cached this way.** Those rows are identical for
every visitor, so there is nothing personal to leak between them. Cache anything
user-scoped like this and Row Level Security has no one to identify — one
person's rows would be stored and served to the next. When in doubt, don't.

Writes call `updateTag`, not `revalidateTag`: the latter now serves stale
content while it refetches, so an administrator would save a translation and
still be looking at the old one.

**Platform admin is not space owner.** Interface wording is shared by every
customer, so only a platform administrator may edit translations. There is no
way to grant it from inside the app — it is set with SQL, deliberately, so
nobody can promote themselves.

## Open items

Agreed but not built. Kept here rather than in a chat so nothing depends on
remembering a conversation.

| # | Item | Note |
| - | ---- | ---- |
| 1 | ~~**Deployment**~~ | **Done.** Live at `app.gidlist.com` — Vercel project `gidlist-web`, functions pinned to `fra1` to match the database, invitation email sending from `noreply@gidlist.com` via Resend. [DEPLOY.md](DEPLOY.md) records the steps and the four places the address is configured. Remaining: the app has still never been used on a phone, despite being built mobile-first, and bare `gidlist.com` still shows the registrar's parking page with no valid certificate. |
| 1a | **Split development from production** | **Queued: do this before announcing the project.** One Supabase project serves both this machine and the live site, so a migration applied by hand in the SQL Editor reaches real customer data the moment it runs, with no staging step and nothing to roll back to. The fix is a second Supabase project for development, `.env.local` pointing at it, and migrations applied there first. Doing it later means moving live data, so the cost only grows. |
| 2 | **Supabase auth email (SMTP)** | Sign-up and password-reset mail still uses Supabase's built-in sender, rate-limited to a handful per hour and explicitly not for production — so sign-ups will start failing silently once more than a few people arrive at once. Now cheap to fix: `gidlist.com` is already verified in Resend, so this is Resend's SMTP credentials pasted into Supabase. See SETUP.md Part 8B. |
| 2c | **Nothing is served statically** | Measured from Tashkent against production, best of 8: a CDN asset 190ms, the proxy redirect 231ms, `/` 452ms, `/login` 463ms. So ~190ms is network, ~41ms the proxy, **~221ms server rendering, and 11ms all database work**. Every page is rendered on demand because `proxy.ts` and the Supabase client read cookies on every request, so even the login form costs a function invocation. This is the largest remaining lever and it is what item 2b would fix. Note the network leg is inflated by requests entering Vercel at its **Hong Kong** edge before reaching Frankfurt. |
| 2a | **Remaining per-request round trips** | Caching the language list and overrides removed two. An authenticated page still pays: the proxy's `auth.getUser()`, a second `getUser()` plus a `profiles` read in `getLocale()` when no locale cookie is set, and `is_platform_admin()` on every dashboard render. These are per-user, so the cache above deliberately does not cover them. Measure before changing anything — Supabase's free tier was a larger share of the original slowness than any of these. |
| 2b | **Migrate to Cache Components** | `unstable_cache` is superseded by the `use cache` directive, which needs `cacheComponents: true` and a pass over the app wrapping runtime data access in `<Suspense>`. Worth doing for the static shell and instant navigation, but it is a refactor, not a patch — hence not done alongside a performance fix. |
| 3 | **Audit log** | Action, timestamp, actor. Write it from database triggers, not app code, so an action cannot happen without being recorded. |
| 4 | **Void a submission, with a reason** | Today a missed record can only be deleted, which is silent. Voiding is recorded, and is what a compliance tool should offer instead. |
| 5 | **Checklist preview** | A read-only rendering on the Details tab showing the checklist as it appears when filled in, without creating a submission. |
| 6 | **Per-checklist discussion** | Message thread per checklist, with Supabase realtime. |
| 7 | **Login page redesign** | Currently a plain centred card; first thing a prospective customer sees. |
| 8 | **Banner cropping** | A non-3:1 image is silently centre-cropped today. Needs fit/fill plus a draggable focal point. |
| 9 | **Cross-section drag** | Items reorder among siblings only. Moving between sections, or changing nesting depth, is not draggable. |
| 10 | **Browser tab titles** | Still English — they are static `metadata` exports and need `generateMetadata` to translate. |
| 11 | **Member hierarchy within a space** | Reporting lines between members, so a supervisor can see and act on their own team rather than the whole space. Needed for planned functionality. Note this cuts across the current visibility model, which is flat: today a member sees only themselves and an editor sees everything. A hierarchy introduces a third case — "mine and my reports'" — which every submission and compliance policy would need to express. Design it before building it. |

## Build order

| Phase | Status | Delivers                                              |
| ----- | ------ | ----------------------------------------------------- |
| 0     | ✅     | Monorepo, database, auth, protected shell             |
| 1     | ✅     | Boards: branding, members, ownership                  |
| 2     | ✅     | Checklist builder: groups, 5-level drag-drop, versions |
| 3     | ✅     | Schedules: recurring + specific dates, assignees      |
| 4     | ✅     | Fill mode: drafts, comments, parent auto-complete     |
| 5     | ✅     | Cases dashboard, charts, filters                      |
| 6     | ✅     | Multi-language + in-app translation editor            |
| 7     |        | Plans, limits, paywall (no live provider yet)         |
| 8     |        | Mobile apps (Expo), reusing phases 1–7                |
| 9     |        | Payme / Click / Paddle — once the entity is registered |

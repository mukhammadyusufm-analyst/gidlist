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
  web/                  Next.js 16 app — the product, at app.gidlist.com
  site/                 Next.js 16 app — the marketing site, at gidlist.com
packages/
  core/                 Shared domain logic. No React, no Next, no React Native,
                        so the Expo app (Phase 8) can import the same rules.
  design/               Design tokens — colour, radius, elevation, type slots.
                        Imported by both apps so neither can drift from the
                        brandbook.
supabase/
  migrations/           Database schema, applied in order
```

Two apps, two Vercel projects, one repository. They are separate deployments on
purpose: an edit to the marketing site must not be able to break the product,
and the product's build must not gate a copy change. What they share, they share
through `packages/` rather than by copying — which is why the palette moved out
of `apps/web/src/app/globals.css` and into `packages/design/tokens.css`.

The site runs on port **3001** so both can run at once.

## Commands

Run from the repository root. **On Windows, add `.cmd` to every Node command** —
`pnpm.cmd`, `npx.cmd`, `npm.cmd`. PowerShell's default execution policy blocks
the script-based shims that npm installs, and `.cmd` sidesteps it without
changing any machine-wide security setting.

| Command          | What it does                                  |
| ---------------- | --------------------------------------------- |
| `pnpm dev`       | Start both: product :3000, site :3001         |
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

**Ask for the user through `getUser()`, never `supabase.auth.getUser()`.**
That call verifies the token against Supabase's auth server — a network round
trip, not a local decode. Rendering one page used to make it three to five
times over. The helper in `lib/supabase/server.ts` is memoised with React's
`cache`; calling the client directly bypasses the memo and quietly restores the
round trip. `proxy.ts` is the one exception: it runs before rendering, in its
own invocation, and its call is what refreshes the session cookie.

**`database.types.ts` is hand-written, and `pnpm db:types` must not overwrite
it.** This schema has no Postgres enums — roles and statuses are `text` with
CHECK constraints — so the generator can only produce `string` where this file
has `BoardRole` and `SubmissionStatus`. That narrowing is what makes
`canGovern()` and the status filters typecheck. The script therefore writes
`database.generated.ts`, which is a reference to diff against. Converting the
constraints to real enums would retire the arrangement; that is open item 12.

**Platform access is capabilities, not a role, and not space ownership.** A
space owner runs their own company's data; platform capabilities reach across
every customer. They are separate systems and must stay so — interface wording
is shared by all customers, so no owner can be allowed to grant it.

Capabilities rather than a role because a role is a bundle, and a bundle is
always slightly wrong for somebody: you end up with "translator plus billing",
then "translator plus billing minus refunds". `translations`, `accounts` and
`grants` compose, and a new one is a row in `platform_capabilities`.

**The root stays out of the app.** `set_platform_grant` refuses to hand out
`grants` itself, so a master can delegate the others but cannot mint another
master, and nobody can promote themselves. That property is why the old boolean
was SQL-only, and it is the one worth keeping while everything below it becomes
delegable. Ask with `has_platform_capability()` — it is `stable` and
`security definer`, so it works inside an RLS policy.

**The Content Security Policy is built per request in `proxy.ts`**, not in
`next.config.ts`, because a strict `script-src` needs a fresh nonce and a static
config cannot produce one. Next reads the nonce back out of the request headers
and stamps it on its own scripts; `strict-dynamic` then refuses anything else.
Every response path in the proxy must set the header — one that escapes without
it has no policy at all, and the gap would be invisible.

## Open items

Agreed but not built. Kept here rather than in a chat so nothing depends on
remembering a conversation.

| # | Item | Note |
| - | ---- | ---- |
| 1 | ~~**Deployment**~~ | **Done.** Live at `app.gidlist.com` — Vercel project `gidlist-web`, functions pinned to `fra1` to match the database, invitation email sending from `noreply@gidlist.com` via Resend. [DEPLOY.md](DEPLOY.md) records the steps and the four places the address is configured. Remaining: the app has still never been used on a phone, despite being built mobile-first, and bare `gidlist.com` still shows the registrar's parking page with no valid certificate. |
| 1a | ~~**Split development from production**~~ | **Done.** `gidlist-dev` (`zffoidgzuyhojnydshkq`, eu-central-1) serves `pnpm dev`; `checklists` (`ivqprkzqnoiffqlbfkkd`) serves `app.gidlist.com` and holds real records. The CLI is linked to **dev**, so `supabase db push` and `pnpm db:types` both act on development — production is still changed by hand in its SQL Editor. **Order: development first, production second**; see SETUP.md. This also unblocks running `supabase/tests/security.sql` in CI, which previously had no database to reach. |
| 2 | ~~**Supabase auth email (SMTP)**~~ | **Done.** Sign-up and password-reset mail goes through Resend's SMTP (`smtp.resend.com`, username the literal word `resend`) from `noreply@gidlist.com`, with the auth rate limits raised off the defaults that protect Supabase's shared sender. The built-in sender allowed a few messages an hour and failed by going quiet — somebody would sign up, see "check your email", and leave. Note the real ceiling is now Resend's plan, not Supabase's: the free tier is 100/day shared with invitation mail, so onboarding a shift of 50 costs the day's allowance. |
| 2c | **Nothing is served statically** | Measured from Tashkent against production, best of 8: a CDN asset 190ms, the proxy redirect 231ms, `/` 452ms, `/login` 463ms. So ~190ms is network, ~41ms the proxy, **~221ms server rendering, and 11ms all database work**. Every page is rendered on demand because `proxy.ts` and the Supabase client read cookies on every request, so even the login form costs a function invocation. This is the largest remaining lever and it is what item 2b would fix. Note the network leg is inflated by requests entering Vercel at its **Hong Kong** edge before reaching Frankfurt. |
| 2a | **Remaining per-request round trips** | Largely addressed: `getUser()` is memoised, and `my_role()` collapsed the role lookup from two round trips to one. What is left per authenticated page: the proxy's own `auth.getUser()` (cannot share the memo — separate invocation), a `profiles` read in `getLocale()` when no locale cookie is set, and `is_platform_admin()` on every dashboard render. Measure before touching these — free-tier cold starts remain the larger share. |
| 2b | **Migrate to Cache Components** — *blocked, see 2d* | Investigated and deliberately not attempted. The migration guide is explicit: when a cookie drives an attribute on `<html>` — `lang`, `data-theme` — reading it on the server makes the whole subtree request-bound, so there is no child left to wrap in `<Suspense>`. Theme is solvable with a pre-paint script. **Locale is not**: a static shell is one shell per route, and with three languages selected by cookie rather than URL there is no single correct version of any translated text. The shell would hold layout chrome and nothing else, so the 221ms of rendering does not disappear — it moves behind a streamed boundary. That buys first byte at ~190ms instead of 452ms, which is perceived speed, not total, in exchange for a refactor across 22 pages and 6 layouts in the area most likely to produce a visible regression. Revisit only after 2d. |
| 2d | **Locale in the URL** | `/uz/...`, `/ru/...` instead of a cookie. Makes a language shareable by link, helps SEO on any marketing pages, and is the prerequisite that would make 2b worth doing. Cheaper now than once there are links in the wild. |
| 3 | ~~**Audit log**~~ | **Done.** `audit_log`, written by triggers on `board_members`, `boards`, `platform_grants` and `subscriptions` — an action the app records is one the app can forget to record, and a trigger cannot be bypassed by a new code path, a direct API call, or a fix applied in the SQL editor. Governance only: a submission already records who ticked what, and auditing every checkbox would bury the twenty rows a year that matter. Append-only by construction — a read policy and nothing else, so Postgres refuses every write from every API role. Space entries are readable by that space's admins, platform entries by `grants` holders. No foreign keys, deliberately: they would erase the subject exactly when it became interesting, and would make deleting a space fail because it tried to record itself. |
| 4 | ~~**Void a submission, with a reason**~~ | **Done.** The last action in the app that destroyed compliance evidence. Voiding **annotates rather than overwrites**: status still says the record was missed, and three columns beside it say who decided it should not count and why. Making 'void' a status would have erased the very fact the reason explains. The reason is required — a void without one is a deletion that leaves a row behind. Admin only, checked inside set_submission_void, which is the only thing permitted to write those columns. Voided records leave the done/missed figures and both sides of the trend percentage, and are reported on their own: counting one as missed defeats the point, counting it as done is a lie. Audited on both void and lift. |
| 5 | ~~**Checklist preview**~~ | **Done.** On the Details tab, showing the checklist as its filler will read it. Previews the draft when there is one — that is the version about to be committed to — and the published one otherwise, so it is never empty on a checklist in use. Originally a separate presentational component, on the reasoning that the real fill sheet is bound to a submission id and reusing it would mean inventing a submission. **Superseded by 18**, which found that reasoning wrong: `readOnly` plus `answer: null` closes every write path without a submission existing at all. |
| 6 | **Per-checklist discussion** | Message thread per checklist, with Supabase realtime. |
| 7 | ~~**Login page redesign**~~ | **Done.** The sign-in page said nothing about what the product is. Now a two-column layout: the form first in reading order and on phones, the explanation beside it on a wide screen where an evaluator is and a worker is not — moved below rather than hidden on small screens, since a prospect opening the link on a phone would otherwise learn nothing. One copy of the words, reordered with CSS. | Currently a plain centred card; first thing a prospective customer sees. |
| 8 | **Banner cropping** | A non-3:1 image is silently centre-cropped today. Needs fit/fill plus a draggable focal point. |
| 9 | **Cross-section drag** | Items reorder among siblings only. Moving between sections, or changing nesting depth, is not draggable. |
| 10 | ~~**Browser tab titles**~~ | **Done.** Thirteen customer-facing pages moved from `export const metadata` to `generateMetadata`, which can await `getTranslations()` — static metadata is evaluated without a request, so it has no way to know which locale the cookie asked for. The five admin pages stay English, matching the rest of that area, which has one reader. |
| 12 | **Real Postgres enums** | Roles, member statuses, version statuses, schedule kinds and submission statuses are `text` + CHECK. Converting them to enum types would let `pnpm db:types` generate `database.types.ts` correctly instead of it being hand-maintained, removing a standing chance of someone widening every union back to `string` by running one command. Needs a migration per type and a types regeneration. |
| 13 | ~~**Enforce the CSP**~~ | **Done.** Built per request in `proxy.ts`, because a strict `script-src` needs a fresh nonce and a static config cannot make one. `strict-dynamic` with a nonce means an injected `<script src>` never runs. Unblocked by the 2b decision: the nonce forces dynamic rendering, which no longer conflicts with anything now that Cache Components is deferred. Two deliberate loosenings, both documented in the file: `style-src` keeps `'unsafe-inline'` because seven components set `style={{…}}` and CSP ignores `'unsafe-inline'` once a nonce is present, so adding one would break the builder rather than tighten it; `'unsafe-eval'` is development-only, for React's dev overlay. Verified in a browser: nonce unique per request, 22 of 24 scripts nonced, React hydrated, no violations. |
| 13a | ~~**Verify the CSP in production**~~ | **Done, and it found something.** Development allows `'unsafe-eval'`, so the local check could not have caught it: production reported a blocked eval from Zod probing for JIT support with `Function("")`. Benign — Zod catches it and interprets schemas instead — but a console with a standing violation is one nobody reads, so the next real one would arrive unnoticed. Fixed with Zod's own `jitless` option rather than by adding `'unsafe-eval'`, which would have weakened the policy for every script to quiet one library. **The fix took two attempts**: Zod decides about JIT when a schema is *constructed*, so configuring it inside a module is not enough — the bundler picks chunk order and a schema elsewhere can be built first. `instrumentation-client.ts` is the one place Next guarantees runs before the app becomes interactive. |
| 14 | ~~**Rate limiting**~~ | **Done.** `enforce_rate_limit()` with a rolling window, enforced in the database — a limit in a server action is bypassed by calling PostgREST directly, which is easier than driving the interface and therefore what an abusive client does. Invitations 30/hour and 100/day per person, materialisation 60/hour. Only *pending* invitations count: accepted members are already bounded by the plan, and it is invitations that never accept which cost sending reputation. Refusals carry SQLSTATE `PT429`, which PostgREST answers as HTTP 429, so a client sees the standard signal rather than a 500. |
| 15 | ~~**Error tracking**~~ | **Done.** `src/instrumentation.ts` exports Next's `onRequestError`, so every server failure — Server Component render, Server Action, route handler, proxy — is caught by the framework rather than by remembering to try/catch. No SDK: it is a framework export and one fetch, so it works on this version of Next today instead of whenever a vendor catches up. Always writes one structured JSON line tagged `app-error`; also posts to `ERROR_WEBHOOK_URL` when set, deduplicated to one notification per distinct error per ten minutes. **Headers are never forwarded** — `request.headers` carries the Supabase session cookie, and the payload is built from an allow-list rather than by stripping known-bad fields. Verified by throwing from a temporary route and reading the log line back. |
| 15a | ~~**Alerting on the nightly job**~~ | **Done.** An hourly `check-job-health` reads pg_cron's own `job_run_details` — rather than a record the jobs keep themselves, which would go quiet exactly when they do — and writes `system.job_stale` into the audit log, with a 12-hour cooldown so a lasting outage does not bury the history. Tolerances live in `job_expectations` as rows, so adding a job is an insert. A banner appears at the top of the admin area when anything is behind, and renders nothing otherwise: a permanent green tick stops being read within a week, and then the day it turns red it is not read either. **Push notification is still not wired** — the alert lands where somebody looks rather than reaching them. Doing that from Postgres needs `pg_net`; see 15b. |
| 15b | **Push the job-health alert** | The health check records staleness but cannot reach out. `pg_net` would let the check POST to the same `ERROR_WEBHOOK_URL` the app uses, turning a thing you find into a thing that finds you. Needs the extension enabled and the URL stored somewhere the database can read. |
| 16 | ~~**RLS test suite**~~ | **Done.** `supabase/tests/security.sql` — paste into the SQL Editor and run. 17 checks over tenant isolation, platform capabilities and plan limits, wrapped in a transaction that rolls back, so it creates and destroys its own fixtures and never touches real data. Five are positive controls: a "cannot see" assertion passes just as well when the fixture failed to build, so each negative is paired with the same query run by someone who *should* see rows. **Run it after every migration that touches a policy.** Not yet in CI — that needs a database CI can reach, which is open item 1a. |
| 17 | **`submissions` retention** | The nightly job materialises occurrences forever and nothing archives. Indexes are right and it is fine at current size, but the compliance dashboard reads this table and it only grows. Decide retention or monthly partitioning before a customer has two years of daily checklists. |
| 11 | **Member hierarchy within a space** | Reporting lines between members, so a supervisor can see and act on their own team rather than the whole space. Needed for planned functionality. Note this cuts across the current visibility model, which is flat: today a member sees only themselves and an editor sees everything. A hierarchy introduces a third case — "mine and my reports'" — which every submission and compliance policy would need to express. Design it before building it. |
| 18 | ~~**Full visual checklist preview**~~ | **Done.** The Details tab now renders the genuine `FillSheet` in `readOnly` mode, under the checklist's own banner and avatar, so an editor sees the sheet a filler sees. No throwaway submission was needed after all: every item is given `answer: null`, which makes `answerId` undefined, which makes `interactive` false independently of `readOnly` — so the checkboxes render `disabled` and both write paths return before reaching a server action. The submit form, the only reader of `submissionId`, is inside `{!readOnly ? … : null}` and never reaches the DOM. Nothing is written and no row enters the compliance record. This retires the second presentational component from item 5 and with it the drift between the two renderers. |
| 19 | ~~**Brandbook**~~ | **Done.** Published at [claude.ai/code/artifact/026f2f16](https://claude.ai/code/artifact/026f2f16-469e-4a20-89de-17251bcef19a) — colour roles, type scale, the mark, voice, and the three taglines. Drawn from `apps/web/src/app/globals.css`, which stays the source of truth: when the tokens change, the book changes. **Three decisions settled** — (a) the name stays Latin in all three languages, no `Гидлист`; (b) the audience is operations **and** offices, two rooms with one problem, which is why the voice rule *"name one room, not both"* exists; (c) each language gets its own tagline rather than a translation — `Get it done.` / `Hammasi bajariladi!` / `Всё будет выполнено!` — the English an instruction, the other two a promise, each built on the word its own language already uses for a finished record (`done` / `Bajarilgan` / `Выполнено`). The two exclamation marks are the sole, deliberate exception to the voice rule against them; the rule itself records the exception rather than being silently contradicted. |
| 20 | **Keep the handover documents current** | Recurring, not one-off. README, SETUP.md, DEPLOY.md and the assistant's memory file are what survive a context window. Whenever a decision is made or reversed, it goes in the README the same day; whenever the setup changes, SETUP.md changes with it. A stale handover is worse than none, because it is believed. |
| 21 | **Marketing website** — *A, B and C done, live* | **gidlist.com is live** in all three languages from the `gidlist-site` Vercel project (`apps/site`). DNS: apex `A @ 216.198.79.1`, `CNAME www 4e153814e3021330.vercel-dns-017.com`, TTL 600; the `app` CNAME and the five Resend records were left untouched and verified. **Phase A:** the app, shared tokens, locale in the URL with `Accept-Language` negotiation and hreflang, security headers. **Phase B:** hero, problem, what-it-does, how-it-works, pricing, closing CTA; scroll reveals are pure CSS `animation-timeline: view()` so a failed bundle cannot blank the page. **Phase C (done):** copy is editable at **Admin → Marketing site**, behind a new `site` platform capability kept separate from `translations` because a bad headline is public and a bad label is not. `site_content` is the same overrides-on-top-of-the-bundle shape as `translations`, so an empty table renders a complete page and **deleting a row is the undo**. Verified against an unreachable host: the site still rendered every section in all three languages. The catalogue moved to `packages/core/src/site-messages.ts` because the admin editor must show the string it overrides — two copies would drift. **Edits appear within ~5 minutes** (ISR); the editor says so, because otherwise it looks broken. **Still hand-mirrored:** pricing figures in `apps/site/src/lib/pricing.ts` drift silently if a price changes in SQL. **Phase D:** blog, knowledge base, sitemap, structured data. **CSP done:** built per request in `apps/site/src/proxy.ts` with a fresh nonce, and stricter than the product’s — `connect-src` is `'self'` alone, because the site’s only database read is `server-only` and its browser never contacts Supabase at all. Set on every response path including the locale redirect; verified that the nonce differs per request and that all 17 of the page’s scripts carry it. **Still deferred:** GSAP and the WebGL moment. `www.gidlist.com` 308-redirects to the apex with the path preserved (`www/ru` to `gidlist.com/ru`), so there is one canonical host and the canonical tags point at it. |
| 22 | **Connect Payme and Click** | Phase 9. The billing structure is built and the seam is lib/billing/provider.ts; this is the provider implementations plus their webhooks, which are the only thing permitted to write a subscription row. Needs the registered entity and signed contracts. Paddle for customers outside Uzbekistan, since Stripe does not onboard Uzbek businesses. |
| 23 | ~~**The app's root page was the Phase 0 placeholder**~~ | **Done.** `/` no longer renders anything — it redirects, signed in to `/dashboard` and signed out to `/login`. Restyling the placeholder would have been the wrong fix: `app.gidlist.com` is the product and `gidlist.com` is where the selling happens, so a landing page here would compete with the marketing site (21) for the same words and drift from it the moment either was edited. Deliberately **not** done in `proxy.ts`, which already resolves the user and reaches the same conclusion for `/login` and `/signup` — that file is the security boundary gating every private route, and a cosmetic routing preference does not justify editing it. Not a permanent redirect: the destination depends on who is asking, so it must never be cached. |
| 24 | **Google sign-in shows Supabase’s domain, not Gidlist** | The consent screen reads *“Sign in to continue to ivqprkzqnoiffqlbfkkd.supabase.co”*. Not a branding misconfiguration — App name, logo and home page are all set correctly to Gidlist. Google names the destination of the OAuth **redirect URI**, and that is Supabase’s callback by design (see SETUP.md Part 7). The only fix is Supabase’s **custom auth domain** add-on, moving auth to `auth.gidlist.com`; then update the redirect URI in both the Google OAuth client and the Supabase dashboard. Paid, per-project, monthly. Cosmetic only — sign-in works and nothing is insecure — but it is a trust cost on every signup, so do it before pointing award judges or paying customers at the product. Roughly fifteen minutes across two dashboards. **Also check while there:** if the consent screen’s Publishing status is still *Testing*, only accounts added as test users can sign in with Google at all. The scopes are email and profile only, which need no Google verification review, so it can move to *In production* without submitting anything. That one is a functional blocker, not cosmetic. |
| 25 | ~~**Per-currency pricing (`plan_prices`)**~~ | **Done.** `plan_prices (plan_code, currency, price_minor)`, the shape `addon_prices` already used. USD is seeded from the existing `plans` rows rather than retyped, so the migration cannot introduce a disagreement with what the product charges on the day it runs. **So’m: 0 / 59,250 / 177,750 / 474,000** — a deliberate local price list, **not a conversion**, and it must never be recomputed from an exchange rate or every Uzbek customer is silently repriced when the rate moves. **No VAT** — the company is an IT Park resident, so the figure is what the customer pays. **The minor-unit trap:** `packages/core/src/money.ts` is the authority and gives UZS an exponent of 0 because the tiyin is defunct, so 59,250 so’m is `59250`, not `5925000`; treating it as two decimals would inflate every Uzbek price a hundredfold and look like a pricing decision rather than a bug. **The site now reads prices from the database** (same fetch-with-fallback pattern as the copy), so `apps/site/src/lib/pricing.ts` is only the fallback for an unreachable database — the hand-mirroring drift is gone. Currency by locale is a **named heuristic**: `uz` and `ru` see so’m, `en` sees dollars, so a Russian speaker in Riga sees the wrong one; it only affects a marketing page, because currency is frozen on the subscription at purchase. `formatPrice` writes the so’m name itself (`so‘m` / `сум`) because CLDR has no Russian symbol for UZS and `Intl` falls back to the code, rendering "59 250 UZS" — the number is still formatted by `Intl`. **Interim:** `plans.price_minor` remains as the base for the SQL billing functions and the in-product billing page; migrating those to `plan_prices` is what remains before a customer can be charged in so’m. |
| 26 | ~~**Gateway selection by currency**~~ | **Done.** `activeGateway()` read one `PAYMENT_PROVIDER` and returned one gateway, so a deployment could only serve one market. Replaced by `gatewaysFor(currency)` reading `PAYMENT_PROVIDERS` (comma-separated), so an Uzbek customer paying in som and a German one paying in dollars are served by different providers from the same build. **Returns a list, not one gateway** — for som there genuinely are two, Payme and Click, and the customer has a preference between them; collapsing that here would mean picking on their behalf with no basis to pick. `isCheckoutAvailable()` now takes a currency for the same reason: with two currencies live, the question has no single answer. Still no implementations — that is item 22, and it is now only the provider code plus webhooks. |
| 27 | ~~**No way to edit prices without SQL**~~ | **Done.** Admin → **Plans and pricing**, behind a new `billing` capability kept separate from `accounts` — seeing what customers pay and changing what they will pay are different jobs. **Narrow on purpose:** UPDATE only, so insert and delete stay impossible through the API for everyone; `code` and `is_free` are frozen by a trigger, the first because `subscriptions` references it and editing it would orphan live customers, the second because it decides whether checkout is offered at all. A free plan priced above zero is refused outright. Every change writes `plan.changed` to `audit_log` with before and after values, because a price is exactly the kind of thing somebody may later be asked to justify. The form takes whole currency units and converts with `Math.round(major * 100)`, since `price_minor` is where a missing decimal turns $40 into $4,000 with no visible difference. **The page warns that gidlist.com does not follow it** — the site’s figures are still hand-mirrored in `apps/site/src/lib/pricing.ts` until item 25. |
| 28 | **Item type: photo or file evidence** | An item that cannot be ticked on its own — it wants a photograph or a document attached. On a phone this is `<input type="file" accept="image/*" capture="environment">`, which opens the camera directly; there is no native app to write and none is needed. **Where it lands:** a new column on the item template (versioned like the rest of the template, so changing it in March does not rewrite what January asked for), and the file on `submission_items` in a new Storage bucket scoped by board — a photograph of a shop floor is that customer’s data and RLS on the bucket is the control, as it is everywhere else. **Two traps.** Storage is not rows: a daily checklist with four photo items is thousands of images a year per customer, so this and item 17 (retention) stop being separable — decide retention *with* this, not after. And plan limits are currently people and spaces; storage is the first resource where a heavy customer costs materially more than a light one, so it may need to reach `plans`. **Honest limit worth writing into the interface:** a photograph proves something was photographed, not that it was photographed here and now. EXIF can be stripped or forged and a photograph of a photograph works. It is far stronger than nothing and much weaker than proof — the product should not claim otherwise, given the whole pitch is a record nobody can quietly edit. |
| 29 | **Item type: location** | An item that must be filled in at a place the checklist author pinned, within a radius they set. Browser `navigator.geolocation`, which needs HTTPS (already true) and a one-time permission prompt. **The accuracy warning is not a nicety, it is the feature.** GPS is roughly 5–20m outdoors and far worse — tens to hundreds of metres, or simply unavailable — indoors, which is precisely where a warehouse, a kitchen and a ward round happen. A radius tight enough to be meaningful will reject people standing in the right place. So: the author sets the radius with a stated minimum, the reading is stored **with its own `accuracy` value**, and a reading whose accuracy is worse than the radius is recorded as inconclusive rather than as a failure. Show the person their accuracy before they submit, not a bare pass or fail. **The bigger honesty problem:** browser geolocation is trivially spoofable — devtools override it, mock-location apps exist. This is a deterrent and a convenience, not evidence, and it must never be described in the interface as proof of presence. **Also decide:** what happens when permission is denied or the device has no fix. Refusing to let somebody complete a safety check because a phone cannot see a satellite is a worse outcome than an unverified tick. |
| 30 | **Require evidence before an item can be ticked** | Depends on 28 and 29 — the point of both. A per-item setting making the photo, file or location mandatory, enforced where it actually matters: **`submit_submission` must refuse a submission with a required piece missing**, because a client-side check is a courtesy and the database is the boundary. **Interactions to settle first.** A parent item completes automatically when its children do — can a parent require evidence, or is that only ever a leaf? Enforce at tick time or at submit time: blocking the tick is clearer, blocking the submit lets somebody work through a checklist in a basement and upload when they resurface. Which points at the real operational failure: **a required photo in a place with no signal is a person who cannot finish their job.** Whatever is decided, decide it deliberately and put it in the interface, rather than discovering it on a loading dock. **And compliance:** a submission blocked for missing evidence is not the same as a missed one, so `compliance_counts` may need to tell them apart — the same reasoning that made voiding its own status rather than a deletion. |
| 31 | ~~**Make the product installable (PWA)**~~ | **Done.** `app/manifest.ts`, icons drawn from the brand mark, an `/offline` page and a service worker. **The worker caches exactly one thing — the offline page.** Nothing else is ever stored, and the fetch handler ignores everything that is not a page navigation: a service-worker cache has no session attached, so anything user-scoped in it is served back to whoever asks next, including a different person on a shared device. Same rule that keeps `unstable_cache` restricted to rows whose SELECT policy is `to public using (true)`. **Two things that had to change to make it work at all.** `worker-src 'self'` in the CSP — `strict-dynamic` makes the browser ignore `'self'` in `script-src`, so worker registration was refused with only a console error. And `manifest.webmanifest` and `sw.js` had to leave the proxy matcher: a browser fetches the manifest **without credentials**, so the proxy saw no session, treated it as a private route and redirected it to `/login` — the browser then had no valid manifest and silently never offered to install. Found by requesting the manifest and reading what came back, which was a login page. `/offline` is in `PUBLIC_ROUTES` and deliberately says nothing it cannot know: the worker caches no checklists, so it promises only that nothing was sent. **Real offline** — filling in a checklist in a basement and syncing later — is a queue of pending writes in IndexedDB, not a response cache, and belongs with Phase 8. |
| 32 | **Create a plan from the admin screen** | The editor is UPDATE-only today, and adding a plan was deliberately excluded because a plan code is not just a price: it needs `plan_features` rows, a `plan_prices` row **per currency**, and a place in the interface. It is worth revisiting once payment providers are connected, because by then a fourth thing is true — the plan must also exist on the provider’s side, and Click, Payme and a Merchant of Record each model that differently. **The real question is whether a plan is data or code.** If the form can create one, it must also create its feature rows and its per-currency prices, or it produces a plan that renders with no capabilities and no price in som. A guided flow that insists on all of it is the only version worth building; a bare "add row" button would be a way to break billing from a web page. Insert and delete have no RLS policy at all today, so this is a database change as well as a screen. |
| 33 | ~~**Group the marketing-copy editor by where the text appears**~~ | **Done.** Nine sections in page order — Search results and sharing, Navigation, Hero, The problem, What it does, How it works, Pricing, Closing call to action, Footer — replacing a flat alphabetical list of 57 dotted keys where changing the hero meant knowing it is called `headline` and `subhead`. The grouping lives in `siteContentSections()` beside the catalogue, not in the screen, so the site declares its own order and the editor renders it. **Sections claim keys by prefix**, so `features.4.title` lands in the right group with nothing to register, and **the last section is a catch-all**: a string matching no prefix appears under "Not yet grouped" rather than vanishing. Silently dropping one would be the worst outcome — copy live on the site and uneditable, with nothing to say why. Within a section, keys sort by which prefix matched rather than alphabetically, so the hero reads tagline, headline, subhead, then buttons; and `.title` sorts above `.body`, because plain alphabetical put every card’s second half first. Search filters inside each section and drops the empty ones, so a query never leaves a heading with nothing under it. Verified by running the function: 57 keys in, 57 grouped, no duplicates, catch-all empty. |
| 34 | ~~**The installed app’s launch screen is ugly**~~ | **Done.** `background_color` is now the brand blue rather than the page background. Android builds the splash from that colour with an icon it picks itself, and against near-white it chose the maskable icon — a hard-edged full-bleed square by design — leaving a sharp blue tile floating on off-white. Setting the field to the same blue means **it no longer matters which icon Android picks**: the maskable one dissolves into the background leaving just the white mark, and the rounded `any` one shows a barely visible edge. Both read as deliberate, and the result stops depending on a heuristic outside our control. The cost is a brief blue field before the app paints its own background, which is the normal shape of a branded launch screen. **Still open for iOS:** it ignores the manifest here and wants `apple-touch-startup-image`, which needs one asset per device size; without it an installed app shows a white screen briefly. |
| 35 | ~~**A submission did not record who filled it in**~~ | **Done, in two parts.** **(1) Who did it:** `submissions.submitted_by` and `submitted_by_email`, written only by `submit_submission()` from `auth.uid()` inside a SECURITY DEFINER function — never from an argument, because a client-supplied name on the row that proves who did the work would be a signature anybody could forge. Compliance gained a **Filled by** column *beside* the assignee, not instead of it: "who was asked" and "who did it" are different questions, and answering the second with the first is what produced "Anyone". **Not back-filled** — nobody recorded it at the time and a plausible guess would be invented evidence; those rows show an em dash. **(2) The rule:** `schedules.assignment_mode` is `creator`, `everyone` or `specific`, never inferred from an absence. **`everyone` means every active member, one obligation each** — the membership list expanded, following who joins and leaves — not a single record anybody may claim. After this no new submission has a null assignee. `specific` requires at least one name, enforced by a **deferred** constraint trigger, because a schedule is written before the names it is about to be given; the same trigger on delete stops a schedule being emptied while claiming to name people, and the mode buttons on each schedule are the way out of that. Naming somebody is what switches a schedule to `specific` — the create form offers only the two modes valid before assignees exist, so there is no state where the interface says "specific people" and means nobody. **Backfill changes behaviour:** schedules that named nobody become `everyone`, so a space of five now generates five obligations per occurrence where it generated one. Stale unassigned `upcoming` rows for future dates are deleted so they do not sit alongside the new per-member ones; drafts, done and missed are untouched and keep reading "Anyone", which is what was true when they were made. |

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

# Going live

Puts the app on the internet at your own domain. Do the parts in order — each
one assumes the one before it worked.

You enter every password and key yourself. Nothing in this file asks you to
share one.

---

## Part 0 — Decide the address, once

Everywhere below, `example.com` means **the domain you bought**. Substitute it
as you go.

Put the app on a subdomain, not the bare domain:

```
app.example.com     ← the app
example.com         ← keep free for a marketing site later
```

Write your choice here so you stop re-deciding:

> My app address: `https://app.________________`

Two things to know before you start:

- **Do not** put the app on a subfolder (`example.com/checklists/`). That needs
  a reverse proxy in front of it — a permanent failure point — and buys nothing,
  because everything behind the login is unindexed anyway.
- The address is **configuration, not code**. It appears in four settings and
  nowhere else. Moving the app later is changing those four settings.

---

## Part 1 — Put the code on GitHub

Vercel deploys from a Git repository, so the code has to live on GitHub first.

The first commit is already made — 168 files, and `.env.local` is deliberately
**not** among them, so your keys stay on your machine.

1. Go to https://github.com/new
2. **Repository name**: `checklist-saas`
3. Choose **Private**.
4. Leave "Add a README file", "Add .gitignore" and "Choose a license"
   **unticked**. Ticking any of them creates a commit on GitHub that conflicts
   with the one you already have, and the push in step 7 will be refused.
5. Click **Create repository**.
6. On the next page, copy the HTTPS address. It looks like
   `https://github.com/<your-username>/checklist-saas.git`
7. In PowerShell, from `C:\Users\Mukhammadyusuf\Desktop\Website\checklist-saas`:

```bash
git remote add origin https://github.com/YOUR-USERNAME/checklist-saas.git
```

8. Then push:

```bash
git push -u origin main
```

9. A browser window may open asking you to sign in to GitHub. That is expected —
   sign in there, not in the terminal.

**You should see** `branch 'main' set up to track 'origin/main'`, and refreshing
the GitHub page shows the folders `apps`, `packages`, `supabase`.

**Check this before continuing**: on GitHub, open `apps/web`. There must be **no
file named `.env.local`**. If it is there, stop and tell me — the keys would be
published and would need replacing, not just deleting.

---

## Part 2 — Create the Vercel project

1. Go to https://vercel.com and sign up with **Continue with GitHub**.
2. Allow Vercel access to the `checklist-saas` repository when asked.
3. On the dashboard click **Add New… → Project**.
4. Find `checklist-saas` in the list and click **Import**.
5. Find **Root Directory**, click **Edit**, and choose the `apps/web` folder.
   This matters: the repository root is a workspace, not the app.
6. **Framework Preset** should now read **Next.js**. If it says "Other", the
   root directory is wrong — go back to step 5.
7. Leave Build Command, Output Directory and Install Command exactly as they
   are. They are detected correctly.
8. **Do not click Deploy yet.** Open **Environment Variables** first and do
   Part 3.

---

## Part 3 — Environment variables

Still on the import screen, add these four. Add each one, then click **Add**
before typing the next.

| Name | Value |
| ---- | ----- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://ivqprkzqnoiffqlbfkkd.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the `sb_publishable_…` key from your `apps/web/.env.local` |
| `NEXT_PUBLIC_APP_URL` | `https://app.example.com` — your address from Part 0 |

Set `NEXT_PUBLIC_APP_URL` now even though the domain does not work yet. It is
only used to build links inside emails, and no email will go out before Part 7.

`RESEND_API_KEY` and `EMAIL_FROM` come later, in Part 7. The app runs fine
without them; invitations simply are not emailed.

> **Never** add the Supabase key labelled **secret** or **service_role** here.
> That key ignores every Row Level Security policy — the entire security model
> of this app. The publishable key is the correct one, and is meant to be public.

9. Now click **Deploy** and wait — the first build takes two or three minutes.

**You should see** a congratulations screen with a screenshot of your login
page, and an address like `checklist-saas-abc123.vercel.app`.

**If the build fails**, copy the red error text from the build log and send it to
me. Build failures at this stage are almost always a missing environment
variable, which is a one-line fix.

---

## Part 4 — Move the app next to the database

Your Supabase database is in Europe. Vercel puts functions in Washington D.C. by
default. Left alone, every database query crosses the Atlantic and comes back —
twice per page, on every page.

1. In the project, go to **Settings → Functions**.
2. Find **Function Region**.
3. Choose **Frankfurt, Germany (fra1)**.
4. **Save**.
5. Go to **Deployments**, open the most recent one, click the **⋯** menu and
   choose **Redeploy**. The region only applies to builds made after the change.

If the region selector is greyed out on your plan, skip this. It costs speed,
not correctness — the app works either way.

**You should see** the region shown as `fra1` after the redeploy finishes.

---

## Part 5 — Attach your domain

1. **Settings → Domains**.
2. Type `app.example.com` and click **Add**.
3. Choose **Add** on the plain option (not the redirect option).
4. Vercel now shows you a DNS record to create — a **CNAME** with a name and a
   value. Leave this page open.
5. In a second tab, sign in to the company you bought the domain from and find
   its **DNS** or **DNS records** page.
6. Add a new record, copying **exactly** what Vercel showed:
   - Type: `CNAME`
   - Name / Host: `app`
   - Value / Target: the address Vercel gave you
   - TTL: leave the default
7. Save it.
8. Return to the Vercel tab and click **Refresh**.

Copy the value from **your** Vercel screen, not from anywhere else. Vercel has
changed these addresses before, and the dashboard is always right.

**You should see** the domain turn to **Valid Configuration** with a green tick.
This usually takes a few minutes. It can take a few hours — DNS is slow to
spread and there is nothing to fix while you wait.

9. Once it is valid, open `https://app.example.com`. The padlock should be
   there; Vercel issues the certificate on its own.

**You should see** your login page, on your own domain.

Signing in will **not work yet** — that is Part 6, and is expected.

---

## Part 6 — Tell Supabase the app moved

Until you do this, signing in redirects to `localhost` and fails.

1. Open your Supabase project → **Authentication** → **URL Configuration**.
2. Set **Site URL** to `https://app.example.com`
3. Under **Redirect URLs**, click **Add URL** and enter:

```
https://app.example.com/**
```

4. **Leave `http://localhost:3000/auth/callback` in the list.** Removing it
   breaks signing in on your own machine while you keep developing.
5. **Save**.

Google needs nothing. The redirect URI you gave Google in SETUP.md Part 7 is
Supabase's address, not your app's, so it does not change when your domain does.

**You should see**, on `https://app.example.com`: sign-up with email works, and
**Continue with Google** returns you to your own domain rather than to
`localhost`.

Test both. This is the step most likely to be half-done.

---

## Part 7 — Send email from your own domain

Invitation emails currently do not send at all. This turns them on.

1. Go to https://resend.com and sign up.
2. **Domains → Add Domain**.
3. Enter `example.com` — the bare domain, not `app.example.com`.
4. Choose the region closest to you.
5. Resend shows several DNS records (`MX`, and `TXT` records for DKIM and SPF).
6. Add every one of them at your registrar, the same way as Part 5.
7. Back in Resend, click **Verify DNS Records**.

**You should see** the domain marked **Verified**. Fifteen minutes is normal.

8. Go to **API Keys → Create API Key**. Give it **Sending access** only.
9. Copy the key. Resend shows it once and never again.
10. In Vercel: **Settings → Environment Variables**, and add:

| Name | Value |
| ---- | ----- |
| `RESEND_API_KEY` | the `re_…` key you just copied |
| `EMAIL_FROM` | `Checklists <noreply@example.com>` |

11. Redeploy, as in Part 4 step 5. Environment variables only reach the app at
    build time.

> The Resend key must **not** be named with a `NEXT_PUBLIC_` prefix. Anything
> with that prefix is sent to every visitor's browser, and this key can send
> mail as your domain.

**You should see**: invite an address you own from the Members tab. The notice
should read "…was invited and has been emailed", and the message should arrive
from your domain.

If the notice instead says "No email was sent", the key or `EMAIL_FROM` did not
reach the running app — check for a typo and confirm you redeployed.

---

## Part 8 — Open it on your phone

The app was built mobile-first and has never run on a phone. This is the first
honest test of that.

Open `https://app.example.com` on your phone and check:

- The login page fits, with no sideways scrolling.
- Tapping a text field does **not** zoom the page in.
- A space, a checklist, and the Fill-in tab are all usable one-handed.
- Dark mode follows the phone's setting.

Send me anything that looks wrong.

---

## After this

`git push` is now the deploy button. Every push to `main` builds and goes live
on your domain within a couple of minutes.

```bash
git add -A
git commit -m "what changed"
git push
```

Your local `apps/web/.env.local` stays as it is — `NEXT_PUBLIC_APP_URL` blank,
so local development keeps using `http://localhost:3000`.

**Database changes do not deploy.** Migrations are still applied by hand in the
Supabase SQL Editor. The database is shared between your machine and the live
site, so a migration takes effect for both the moment you run it.

That last point deserves care: there is only one database. Local development and
real customers are looking at the same rows. Separating them is worth doing
before the first paying customer, and is not worth doing today.

---

## The four places the address lives

If you ever move the app again, this is the whole list.

| Where | Setting |
| ----- | ------- |
| Vercel | Settings → Domains |
| Vercel | `NEXT_PUBLIC_APP_URL` environment variable |
| Supabase | Authentication → URL Configuration |
| Resend | Verified sending domain |

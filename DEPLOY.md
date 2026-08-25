# Going live

Puts the app on the internet at **gidlist.com**. Do the parts in order — each
one assumes the one before it worked.

You enter every password and key yourself. Nothing in this file asks you to
share one.

---

## Part 0 — The address

The app goes on a subdomain:

```
app.gidlist.com     ← the app
gidlist.com         ← stays free for a marketing site later
```

Two things to know before you start:

- **Do not** put the app on a subfolder (`gidlist.com/app/`). That needs a
  reverse proxy in front of it — a permanent failure point — and buys nothing,
  because everything behind the login is unindexed anyway.
- The address is **configuration, not code**. It appears in four settings and
  nowhere else. Moving the app later is changing those four settings, listed at
  the end of this file.

---

## Part 1 — Put the code on GitHub

Vercel deploys from a Git repository, so the code has to live on GitHub first.

The first commits are already made, and `apps/web/.env.local` is deliberately
**not** among the tracked files, so your keys stay on this machine.

1. Go to https://github.com/new
2. **Repository name**: `gidlist`
3. Choose **Private**.
4. Leave "Add a README file", "Add .gitignore" and "Choose a license"
   **unticked**. Ticking any of them creates a commit on GitHub that conflicts
   with the ones you already have, and the push in step 8 will be refused.
5. Click **Create repository**.
6. On the next page, copy the HTTPS address. It looks like
   `https://github.com/YOUR-USERNAME/gidlist.git`
7. In PowerShell, from `C:\Users\Mukhammadyusuf\Desktop\Website\checklist-saas`,
   with your own username in place of `YOUR-USERNAME`:

```bash
git remote add origin https://github.com/YOUR-USERNAME/gidlist.git
```

8. Then push:

```bash
git push -u origin main
```

9. A browser window may open asking you to sign in to GitHub. That is expected —
   sign in there, not in the terminal.

The folder on your computer stays named `checklist-saas`. That is fine and worth
not fixing; renaming a folder that a running dev server is watching causes more
trouble than the inconsistency does.

**You should see** `branch 'main' set up to track 'origin/main'`, and refreshing
the GitHub page shows the folders `apps`, `packages`, `supabase`.

**Check this before continuing**: on GitHub, open `apps/web`. There must be **no
file named `.env.local`**. If it is there, stop and tell me — the keys would be
published, and would then need replacing rather than just deleting.

---

## Part 2 — Create the Vercel project

1. Go to https://vercel.com and sign up with **Continue with GitHub**.
2. Allow Vercel access to the `gidlist` repository when asked.
3. On the dashboard click **Add New… → Project**.
4. Find `gidlist` in the list and click **Import**.
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

Still on the import screen, add these three. Add each one, then click **Add**
before typing the next.

| Name | Value |
| ---- | ----- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://ivqprkzqnoiffqlbfkkd.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the `sb_publishable_…` key from `apps/web/.env.local` |
| `NEXT_PUBLIC_APP_URL` | `https://app.gidlist.com` |

Set `NEXT_PUBLIC_APP_URL` now even though the domain does not work yet. It is
only used to build links inside emails, and no email will go out before Part 7.

`RESEND_API_KEY` and `EMAIL_FROM` come later, in Part 7. The app runs fine
without them; invitations simply are not emailed.

> **Never** add the Supabase key labelled **secret** or **service_role** here.
> That key ignores every Row Level Security policy — the entire security model
> of this app. The publishable key is the correct one, and is meant to be public.

9. Now click **Deploy** and wait — the first build takes two or three minutes.

**You should see** a congratulations screen with a screenshot of your login
page, and a temporary address like `gidlist-abc123.vercel.app`.

**If the build fails**, copy the red error text from the build log and send it to
me. Failures at this stage are almost always a missing environment variable,
which is a one-line fix.

---

## Part 4 — Move the app next to the database

Your Supabase database is in Europe. Vercel puts functions in Washington D.C. by
default. Left alone, every database query crosses the Atlantic and comes back —
several times per page, on every page.

1. In the project, go to **Settings → Functions**.
2. Find **Function Region**.
3. Expand **Europe** and tick **Frankfurt, Germany (eu-central-1) — fra1**.
4. Expand **North America** and **untick Washington, D.C. (iad1)**.

   The Hobby plan allows exactly one region, so the old one has to come off
   before the new one can be saved. Each group header carries a badge naming the
   region selected inside it — when only `fra1` remains, the selection is right.

5. **Save**.
6. Go to **Deployments**, open the most recent one, click the **⋯** menu and
   choose **Redeploy**. The region only applies to builds made after the change,
   which is what the panel means by "a new Deployment is required".

**You should see** the region shown as `fra1` once the redeploy finishes.

---

## Part 5 — Attach the domain

1. In the project's left sidebar, click **Domains**. It is a page of its own,
   alongside Deployments and Logs — **not** inside Settings.
2. Click **Add Existing**. (**Buy** is for purchasing a new domain, which you
   already did elsewhere.)
3. Type `app.gidlist.com`, leave **Connect to an environment → Production**
   selected, and click **Add Domain**.
4. The domain joins the list marked **Invalid Configuration**, and Vercel shows
   a **CNAME** record with a name and a value. Invalid is expected until the DNS
   record exists. Leave this page open.
5. In a second tab, sign in to whoever you bought `gidlist.com` from and find
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
spread, and there is nothing to fix while you wait.

9. Once it is valid, open `https://app.gidlist.com`. The padlock should be
   there; Vercel issues the certificate on its own.

**You should see** your login page, on your own domain.

Signing in will **not work yet**. That is Part 6, and is expected.

### Optional: make the bare domain go somewhere

Right now `gidlist.com` with no `app.` leads nowhere, which looks broken to
anyone who types it. Until there is a marketing site:

10. **Domains → Add Existing**, enter `gidlist.com`.
11. Choose **Redirect to Another Domain**, and pick `app.gidlist.com`.
12. Leave it as **307 Temporary Redirect**. Browsers cache permanent redirects
    more or less forever, which would fight you the day a marketing site goes on
    `gidlist.com`. Temporary is also the truthful description.
13. Add the DNS record Vercel shows — for a bare domain this is an **A** record,
    not a CNAME.

Undo this the day a marketing site exists. It is a placeholder, not a decision.

---

## Part 6 — Tell Supabase the app moved

Until you do this, signing in redirects to `localhost` and fails.

1. Open your Supabase project → **Authentication** → **URL Configuration**.
2. Set **Site URL** to `https://app.gidlist.com`
3. Under **Redirect URLs**, click **Add URL** and enter:

```
https://app.gidlist.com/**
```

4. **Leave `http://localhost:3000/auth/callback` in the list.** Removing it
   breaks signing in on your own machine while you keep developing.
5. **Save**.

Google needs nothing. The redirect URI you gave Google in SETUP.md Part 7 is
Supabase's address, not your app's, so it does not change when your domain does.

**You should see**, on `https://app.gidlist.com`: signing up with email works,
and **Continue with Google** returns you to your own domain rather than to
`localhost`.

Test both. This is the step most likely to be left half-done.

---

## Part 7 — Send email from your own domain

Invitation emails currently do not send at all. This turns them on.

1. Go to https://resend.com and sign up.
2. **Domains → Add Domain**.
3. Enter `gidlist.com` — the bare domain, not `app.gidlist.com`.
4. Choose the region closest to you.
5. Resend shows several DNS records — an `MX` record and `TXT` records for DKIM
   and SPF.
6. Add every one of them at your registrar, the same way as Part 5.
7. Back in Resend, click **Verify DNS Records**.

**You should see** the domain marked **Verified**. Fifteen minutes is normal.

8. Go to **API Keys → Create API Key**. Give it **Sending access** only.
9. Copy the key. Resend shows it once and never again.
10. In Vercel: **Settings → Environment Variables → Add Environment Variable**.
    Add these as **two separate dialogs** — the Type selector applies to the
    whole dialog, and these two want different types.

| Name | Type | Value |
| ---- | ---- | ----- |
| `RESEND_API_KEY` | **Secret** | the `re_…` key you just copied |
| `EMAIL_FROM` | **Config** | `Gidlist <noreply@gidlist.com>` |

11. Set **Environments** to **Production** for both. Not Preview.

    Preview deployments are builds from unfinished branches. With the key
    present they can send real mail from your domain to real people; without it
    the app degrades exactly as designed — invitations are still recorded, they
    are simply not emailed. That is the safer failure.

12. Redeploy, as in Part 4 step 6. Vercel injects environment variables into the
    running functions at deploy time, so the deployment currently serving the
    site keeps saying "No email was sent" until a new build replaces it.

> The Resend key must **not** be given a `NEXT_PUBLIC_` prefix. Anything with
> that prefix is sent to every visitor's browser, and this key can send mail as
> your domain.

**You should see**: invite an address you own from the Members tab. The notice
should read "…was invited and has been emailed", and the message should arrive
from `noreply@gidlist.com`.

If the notice instead says "No email was sent", the key or `EMAIL_FROM` did not
reach the running app — check for a typo, and confirm you redeployed.

---

## Part 8 — Open it on your phone

The app was built mobile-first and has never run on a phone. This is the first
honest test of that.

Open `https://app.gidlist.com` on your phone and check:

- The login page fits, with no sideways scrolling.
- Tapping a text field does **not** zoom the page in.
- A space, a checklist, and the Fill-in tab are all usable one-handed.
- Dark mode follows the phone's own setting.

Send me anything that looks wrong.

---

## After this

`git push` is now the deploy button. Every push to `main` builds and goes live
on `app.gidlist.com` within a couple of minutes.

```bash
git add -A
git commit -m "what changed"
git push
```

Your local `apps/web/.env.local` stays as it is, with `NEXT_PUBLIC_APP_URL`
blank, so local development keeps using `http://localhost:3000`.

**Database changes do not deploy.** Migrations are still applied by hand in the
Supabase SQL Editor, and there is currently only one database — your machine and
the live site read the same rows, so a migration takes effect for both the
moment you run it. Splitting them is queued for before the announcement; see the
README's open items.

---

## The four places the address lives

If the app ever moves again, this is the whole list.

| Where | Setting |
| ----- | ------- |
| Vercel | Settings → Domains |
| Vercel | `NEXT_PUBLIC_APP_URL` environment variable |
| Supabase | Authentication → URL Configuration |
| Resend | Verified sending domain |

# Setup — do this once

Follow the steps in order. Each one ends with **You should see** — if you don't
see that, stop there and say so rather than continuing.

You will type every password and key yourself. Nothing here asks you to share one.

---

## Part 1 — Create the Supabase project

1. Open https://supabase.com/dashboard
2. Click **New project**.
3. Name it `checklists`.
4. Under **Database Password**, click **Generate a password**.
5. Click the copy icon, and paste that password somewhere safe now.
6. Under **Region**, choose **Europe**.
   - Asia-Pacific may be labelled "recommended". Ignore that — see the note below.
   - If it then asks for a specific city, choose **Frankfurt**. If it does not
     ask, Europe on its own is fine.
7. If you see an option for **automatic RLS** (Row Level Security), turn it **on**.
8. Click **Create new project**.
9. Wait about two minutes.

**You should see** the project dashboard, with the green text "Project is healthy".

> Leave automatic RLS on permanently. A table created without it is not broken
> and shows no error — it simply allows anyone with the public key to read and
> write it, indefinitely, until someone happens to notice. With it on, a missing
> policy shows up harmlessly as "my query returned nothing".

> Measured from Tashkent: Frankfurt ~110 ms, Stockholm ~113 ms, Zurich ~116 ms,
> Singapore ~169 ms, Mumbai ~210 ms, US East ~213 ms.
>
> Supabase may mark Asia-Pacific as "recommended". That is inferred from your
> IP's geography, and geography is misleading here — every Asia-Pacific option
> measured slower than every European one.
>
> Mumbai is half Frankfurt's distance and twice its latency — Uzbek traffic has
> little direct southbound transit and routes through Europe either way. Choose
> a European region; do not choose Mumbai or a US one.
>
> Supabase cannot move a project between regions later, so this is worth
> getting right now rather than migrating a live database.
>
> Most queries will not pay this cost anyway: the browser talks to Vercel and
> Vercel talks to Supabase, so a page runs its queries next door to the
> database. That only holds if Vercel's functions sit in Frankfurt too, which
> we configure at deploy time.

---

## Part 2 — Create the database tables

1. In the left sidebar, click **SQL Editor**.
2. Click **New query**.
3. Open this file on your computer:
   `C:\Users\Mukhammadyusuf\Desktop\Website\checklist-saas\supabase\migrations\20260804000000_phase0_identity.sql`
4. Select all of it, and copy it.
5. Paste it into the SQL Editor box.
6. Click **Run**.

**You should see** "Success. No rows returned" at the bottom.

Now check it worked:

7. In the left sidebar, click **Table Editor**.

**You should see** a table named `profiles` in the list.

---

## Part 3 — Copy your two keys into the app

1. In the left sidebar, click **Project Settings** (the gear icon at the bottom).
2. Click **API**.
3. Leave this browser tab open — you will copy two values from it.

Now open PowerShell and run this to open your settings file in Notepad:

```bash
notepad "C:\Users\Mukhammadyusuf\Desktop\Website\checklist-saas\apps\web\.env.local"
```

4. Find the **Project URL**. It is not on the API keys list — look under
   **Project Settings -> Data API**, or the **Connect** button in the top bar.
   - Can't find it? Look at your browser's address bar. It reads
     `supabase.com/dashboard/project/abcdefgh`. Your Project URL is then
     `https://abcdefgh.supabase.co`
5. In Notepad, paste it after `NEXT_PUBLIC_SUPABASE_URL=`
6. In the browser, copy the **Publishable** key. It starts with `sb_publishable_`.
   (On older projects this is labelled **anon public** instead — same thing.)
7. In Notepad, paste it after `NEXT_PUBLIC_SUPABASE_ANON_KEY=`
8. Save the file and close Notepad.

**You should see** two lines in the file that each have a long value after the
`=` sign, with no spaces around the `=`.

> ⚠️ The other key on that page is the **Secret** key (`sb_secret_...`, called
> **service_role** on older projects). Do **not** put it in this file. It
> ignores every security rule we set up.
>
> It does have a real use later — the nightly job in Phase 3 that marks missed
> checklists needs it — but it goes in a server-only variable at that point.
> Anything named `NEXT_PUBLIC_...` is compiled into the browser bundle, so a
> secret key there is published to every visitor.

---

## Part 4 — Tell Supabase where your app lives

1. In the left sidebar, click **Authentication**.
2. Click **URL Configuration**.
3. In the **Site URL** box, enter: `http://localhost:3000`
4. Under **Redirect URLs**, click **Add URL**.
5. Enter: `http://localhost:3000/auth/callback`
6. Click **Save**.

**You should see** your URL listed under Redirect URLs.

> Without this, the confirmation email link will refuse to sign you in.
> The live address, `https://app.gidlist.com`, is added here at deployment —
> see DEPLOY.md Part 6. Keep the localhost entry when you do, or signing in
> stops working on this machine.

---

## Part 5 — Start the app

In PowerShell, run:

```bash
cd "C:\Users\Mukhammadyusuf\Desktop\Website\checklist-saas"; pnpm.cmd dev
```

> Note the `.cmd`. Windows blocks PowerShell scripts by default, and the plain
> `pnpm` command is one. `pnpm.cmd` is the same program in a form Windows treats
> as an application, so it runs without changing any security setting.
>
> **This applies to every Node command**, not just pnpm. Always type:
> `pnpm.cmd`, `npx.cmd`, `npm.cmd`. If you see
> *"running scripts is disabled on this system"*, you left off the `.cmd`.

Wait for it to say `Ready`.

Then open http://localhost:3000 in your browser.

**You should see** a page headed "Operational checklists that actually get
completed", with **Get started** and **Sign in** buttons.

To stop the app later, click in the PowerShell window and press `Ctrl` + `C`.

---

## Part 6 — Check that signing up works

1. Click **Get started**.
2. Enter your name, your email, and a password of at least 8 characters.
3. Click **Create account**.

**You should see** a green message telling you to check your email.

4. Open that email and click the confirmation link.

**You should see** the Dashboard page, with your name at the top right.

5. Go back to Supabase, click **Table Editor**, then **profiles**.

**You should see** one row, containing your name.

That last check is the important one: it proves the database, the signup
trigger, and the security rules are all working together.

---

## If something goes wrong

**"Environment is not configured correctly"** — Part 3 didn't take. Reopen
`.env.local` and check there are no quotes or spaces around the values.

**The confirmation email never arrives** — check spam. Supabase's built-in mail
is rate-limited to a few messages per hour and is not meant for real customers;
we replace it with a proper email provider before launch.

**"Invalid API key"** — you likely copied the **Secret** key instead of the
**Publishable** one. Redo steps 6–7 in Part 3.

**"running scripts is disabled on this system"** — you typed `pnpm` instead of
`pnpm.cmd`. See the note in Part 5.

**Every page shows 404, including the home page** — leftover build files. Stop
the app with `Ctrl` + `C`, then run this and start it again:

```bash
Remove-Item "C:\Users\Mukhammadyusuf\Desktop\Website\checklist-saas\apps\web\.next" -Recurse -Force
```

Nothing of yours is in that folder — it is entirely regenerated on the next
start.

---

## Part 7 — Sign in with Google (optional, do once)

Until this is done, the **Continue with Google** button appears but fails with
"provider is not enabled". Email sign-in keeps working regardless.

### First, get credentials from Google

1. Open https://console.cloud.google.com
2. At the top, click the project dropdown, then **New project**.
3. Name it `Checklists` and click **Create**.
4. In the left menu choose **APIs & Services**, then **OAuth consent screen**.
5. Choose **External** and click **Create**.
6. Fill in **App name** (`Checklists`), **User support email**, and
   **Developer contact email**. Leave everything else alone.
7. Click **Save and continue** through the remaining steps, then **Back to dashboard**.
8. In the left menu click **Credentials**.
9. Click **Create credentials**, then **OAuth client ID**.
10. For **Application type** choose **Web application**.
11. Under **Authorised redirect URIs**, click **Add URI** and paste exactly:

```
https://ivqprkzqnoiffqlbfkkd.supabase.co/auth/v1/callback
```

12. Click **Create**.

**You should see** a panel showing a **Client ID** and a **Client secret**.
Leave it open.

> That redirect URI is Supabase's address, not your app's. Google hands the
> user to Supabase, and Supabase then hands them to your app — which is why
> your own domain does not appear here.

### Then tell Supabase about them

1. Open your Supabase dashboard.
2. Click **Authentication** in the left sidebar.
3. Click **Providers** (**Sign In / Up** on newer dashboards).
4. Find **Google** in the list and click it.
5. Turn on **Enable Sign in with Google**.
6. Copy the **Client ID** from the Google tab and paste it in.
7. Copy the **Client secret** from the Google tab and paste it in.
8. Click **Save**.

**You should see** Google listed as enabled.

Now test: open the app, click **Continue with Google**, and pick your account.

**You should see** the Spaces page, with your Google name and picture already
filled in.

> While the Google consent screen is in "Testing" mode, only accounts you add
> as test users can sign in. Publishing it is a separate step in the Google
> console, and is worth doing before real customers use it.

---

## Part 8 — Sending invitation emails (optional)

Until this is set up, invitations are still created and still work — the invited
person just has to be told by other means, because nothing is sent. The app says
which happened after each invite.

There are **two separate email paths**, and they are configured in different
places. This part covers the first.

### A. Invitation emails (sent by the app)

This turns invitation emails on **for the app running on this machine**. For the
live site the same key goes into Vercel instead — DEPLOY.md Part 7. Doing it
here first is optional; you can skip straight to deploying.

1. Open https://resend.com and create a free account.
2. Click **Domains** -> **Add Domain**.
3. Enter `gidlist.com` — the bare domain, not `app.gidlist.com`.

   > Verify the product's own domain, not a domain you use for anything else.
   > Sending reputation attaches to the sending domain, so mail from the product
   > should not be able to affect other mail you send.

4. Resend shows several DNS records. Add each one at whoever hosts DNS for
   `gidlist.com`.
5. Back in Resend, click **Verify**. This can take a few minutes.

**You should see** the domain marked **Verified**.

6. Click **API Keys** -> **Create API Key**. Name it `checklists`.
7. Copy the key. It is shown once.
8. Open your settings file:

```bash
notepad "C:\Users\Mukhammadyusuf\Desktop\Website\checklist-saas\apps\web\.env.local"
```

9. Paste the key after `RESEND_API_KEY=`
10. After `EMAIL_FROM=` enter a sending address on the verified domain, written
    like this — the display name matters, plain addresses look like spam:

```
Gidlist <noreply@gidlist.com>
```

11. Save, then restart the app (`Ctrl` + `C`, then `pnpm.cmd dev`). Environment
    variables are only read at startup.

**You should see** "was invited and has been emailed" after inviting somebody,
instead of "No email was sent".

> Do not put the Resend key anywhere named `NEXT_PUBLIC_...`. Anything with that
> prefix is compiled into the browser bundle, and this key can send mail as your
> domain.

### B. Sign-up and password-reset emails (sent by Supabase)

Invitation emails (Part 8A) are sent by the app. **Confirmation and
password-reset emails are sent by Supabase**, through a different sender, and
these are the ones that decide whether somebody can finish signing up.

Supabase's built-in sender is **rate-limited to a few messages per hour** and is
explicitly not for production. It fails by going quiet: past the limit, sign-up
mail simply stops, the person sees "check your email", and nothing arrives.
Nobody reports that as a bug — they leave.

1. Open https://resend.com -> **API Keys** -> **Create API Key**.
2. Name it `supabase-smtp`, permission **Sending access**.

   > A second key, not the one in Vercel. That one is stored as Sensitive and
   > cannot be read back — and separate keys mean either can be revoked without
   > taking the other down with it.

3. Copy the `re_...` key. It is shown once.
4. In Supabase: **Project Settings** -> **Authentication** -> **SMTP Settings**.
5. Turn on **Enable Custom SMTP**.
6. Enter exactly:

| Field | Value |
| ----- | ----- |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | the `re_...` key from step 3 |
| Sender email | `noreply@gidlist.com` |
| Sender name | `Gidlist` |

> The username is the literal word `resend`, not an email address. It is the
> single most common thing to get wrong here, and the error it produces —
> authentication failed — reads as if the key were bad.

7. **Save**.
8. Still in Authentication, find **Rate Limits** and raise the hourly email
   limit. The default is set low because it protects Supabase's shared sender;
   once mail goes through your own provider, that ceiling is only throttling
   your own sign-ups.

**You should see**: sign up with an address you have not used before, and the
confirmation email arrives from `noreply@gidlist.com` rather than from
Supabase. Check the spam folder too — mail from a verified domain should land
in the inbox, and if it does not, DNS is worth re-checking before customers
arrive.

---

## Two databases: development and production

There are two Supabase projects, and knowing which is which matters more than
anything else in this file.

| | Project | Used by |
| - | ------- | ------- |
| **Production** | `ivqprkzqnoiffqlbfkkd` | `app.gidlist.com`. Real customers, real records. |
| **Development** | the second one | `pnpm dev` on this machine. Disposable. |

Until this split existed, every migration went straight to production the
moment it was written — the app on this machine and the live site read the same
rows, so a mistake in the SQL editor was a mistake in front of customers, with
nothing to roll back to.

**The order is now: development first, production second.**

1. Write the migration.
2. Apply it to **development** and use the app until you believe it.
3. Apply the same file to **production**.
4. Run `supabase/tests/security.sql` against production if the migration touched
   a policy, a role or a capability.

Never the other way round. A migration that has only ever run against
production has never been tested — it has been performed.

### Which project am I pointed at?

`apps/web/.env.local` decides it for local development, and its
`NEXT_PUBLIC_SUPABASE_URL` names the project. The Vercel environment variables
decide it for the live site and should never point anywhere but production.

If you are unsure which database you are about to change, look at the project
name in the Supabase dashboard's top bar before running anything. That is a
two-second check against the one mistake here that cannot be undone.

---

## Applying a new migration (once per phase)

The Supabase CLI is linked to your project, so this is one command:

```bash
cd "C:\Users\Mukhammadyusuf\Desktop\Website\checklist-saas"; npx.cmd supabase db push
```

It compares `supabase\migrations\` against what your database has already had,
and applies only the new files, in order. Nothing to track by hand.

**You should see** the names of the new files, then `Finished supabase db push`.

If a migration fails, **nothing from that file was applied** — each is wrapped
in a transaction, so a failure undoes itself completely. Send me the error and
re-run after I fix it.

### If `db push` times out

Sometimes the CLI cannot reach the database and hangs, then reports
*"failed to connect as temp role ... Connection timed out"*. The app keeps
working, because the app talks HTTPS on port 443 while the CLI needs the
Postgres port (5432/6543) — and that port is what some networks block or
throttle. It has come and gone on this connection, so try again first.

If it persists, apply the migration through the dashboard instead:

1. Supabase -> **SQL Editor** -> **New query**
2. Open the migration file and copy its **contents** (not its file path)
3. Paste and **Run**

You will see a *"Potential issue detected"* warning whenever the script contains
`drop policy` or `drop trigger`. That is expected: Postgres has no "replace
policy" statement, so changing one means dropping and recreating it on the next
line. Read it each time — but a drop-then-recreate of a policy or trigger is
safe. A `drop table`, or a `delete` with no `where`, is not: stop and ask.

Then record it, once the connection is back:

```bash
cd "C:\Users\Mukhammadyusuf\Desktop\Website\checklist-saas"; npx.cmd supabase migration repair --status applied 20260812010000
```

Use the number of the migration you ran. Without this the CLI will offer to
re-apply it later — harmless, since migrations are written to be repeatable,
but it clutters the history.

To see what is applied versus outstanding:

```bash
cd "C:\Users\Mukhammadyusuf\Desktop\Website\checklist-saas"; npx.cmd supabase migration list
```

> The old way was pasting each file into the dashboard's SQL Editor. That still
> works, but the database then has no record of it — which is what caused a
> missing function and a lot of confusion in Phase 2. Use `db push`.

There is no list to keep here — `migration list` is the authority, and each
file's header comment explains what it does and why.

---

## Deploying to Vercel

Not yet. Deploy is worth doing once boards exist in Phase 1, so there is
something real to look at. When we get there it is: connect the GitHub repo,
set the same two environment variables, and add the live URL to Part 4's list.

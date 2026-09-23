# HireWire — Functionality Audit

**Date:** 2026-09-21
**Commit audited:** `b7a0fe2`
**Scope:** Full review of every route, component, `middleware.ts`, and `hirewire_schema.sql`.

**Verification:** `npx tsc --noEmit`, `npx eslint .`, and `npx next build` were all run against this commit.
The build and typecheck pass, so everything below is a **behavior** bug, not a compile error. Lint fails (see #10).

---

## Summary

| Severity | Count | Theme |
|---|---|---|
| ~~🔴 Critical~~ | ~~2~~ | ✅ Both fixed — see status notes below |
| 🟠 Broken functionality | 7 | Dead Tailwind palette, missing routes, silent failures |
| 🟡 Quality / correctness | 6 | Lint, schema idempotency, indexes, palette drift |
| ⚪ Not implemented | 1 | Phases 3 & 4 backend |

### What currently works

Auth (email/password + Google OAuth), folder CRUD, application CRUD, RLS scoping, and the Gmail
token-grant flow all function correctly. The production build is green.

---

## 🔴 Critical

### 1. Gmail OAuth `state` is the user ID — account-linking CSRF

> **Status: FIXED.** A random nonce is now stored in an httpOnly `gmail_oauth_state`
> cookie and verified on return, and the callback derives identity from
> `getUser()` instead of the URL. Shared constants live in `src/lib/gmail-oauth.ts`.

**Files:** `src/app/auth/gmail/route.ts:26`, `src/app/auth/gmail/callback/route.ts:14`

`/auth/gmail` sends `state: user.id`, and the callback trusts that query parameter as the identity
to store tokens against. The OAuth `state` parameter exists to be an unguessable, per-request
anti-CSRF nonce — a user ID is neither unguessable nor request-scoped.

**Impact:** a logged-in user who follows a crafted callback URL can have a *different* Google account
linked to their HireWire account. Once Phase 4 ships, the scanner would then read the wrong inbox
while matching against that user's applications.

Note that the callback never calls `getUser()` at all — identity comes entirely from the URL.

**Fix:** generate a random `state`, persist it in an `httpOnly` cookie before redirecting to Google,
compare it on return, and derive the user from the session rather than the URL.

```ts
// src/app/auth/gmail/route.ts
const state = crypto.randomUUID();
const res = NextResponse.redirect(`${GOOGLE_AUTH_URL}?${params}`); // params.state = state
res.cookies.set("gmail_oauth_state", state, {
  httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/",
});
return res;
```

```ts
// src/app/auth/gmail/callback/route.ts
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) return NextResponse.redirect(`${origin}/auth`);

const expected = request.cookies.get("gmail_oauth_state")?.value;
if (!expected || expected !== searchParams.get("state")) {
  return NextResponse.redirect(`${origin}/dashboard?gmail=error`);
}
// ...then upsert with user_id: user.id — never the URL value
```

Clear the cookie after use.

> Because `/auth/gmail` currently uses `redirect()` from `next/navigation`, it must be restructured
> to return a `NextResponse` so the cookie can be attached.

### 2. Gmail refresh tokens are readable by the browser

> **Status: FIXED — requires a manual Supabase migration.** Tokens are hidden by
> column-level GRANTs (RLS is row-level and cannot hide columns), writes go
> through a `security definer` function so the browser role has no insert/update
> privilege at all, and status is read from a tokenless `integration_status`
> view. **Run the updated `hirewire_schema.sql` in the Supabase SQL Editor.**
>
> Verified against a real PostgreSQL 16 instance: token reads denied for the
> owner and for other users, direct writes denied, connect/re-connect and
> Disconnect working, and `service_role` still able to read tokens.

**File:** `hirewire_schema.sql:128-130`

```sql
create policy "integrations: own rows only"
  on public.integrations for all
  using (auth.uid() = user_id);
```

This grants `SELECT` on the row to the browser's anon-key client, so
`supabase.from("integrations").select("refresh_token")` succeeds from client-side JavaScript.
A single XSS therefore exfiltrates a long-lived Gmail refresh token — which does not expire on
logout and grants read access to the user's entire inbox.

**Fix:** make token columns service-role-only. `src/app/dashboard/layout.tsx:26` only reads `id`,
so nothing in the frontend needs the token values:

1. Drop the blanket `for all` policy.
2. Add a narrow `delete` policy (the Disconnect button in `DashboardShell.tsx:100` needs it).
3. Expose connection *status* through a view selecting only `id, provider, created_at`, and point
   the dashboard layout at that view.

The scanner backend uses the `service_role` key, which bypasses RLS, so it is unaffected.

---

## 🟠 Broken functionality

### 3. Tailwind v4 never loads `tailwind.config.ts` — the whole `brand-*` palette is dead

> **Status: FIXED.** The full palette (`brand-blue`, `brand-navy`, `brand-light`,
> `brand-muted`) now lives in `@theme` in `globals.css`, and `tailwind.config.ts`
> was deleted. Verified by grepping the compiled CSS in `.next/`: `.bg-brand-blue`,
> `.text-brand-blue`, `.border-brand-blue`, `.bg-brand-light`, and `.bg-brand-navy`
> all emit real rules now, and `--color-brand-navy` matches the config's `#0A0F2C`.

**Files:** `tailwind.config.ts`, `src/app/globals.css`, `src/components/dashboard/DashboardShell.tsx`

`postcss.config.mjs` uses `@tailwindcss/postcss` (Tailwind v4), where a JS/TS config is **only**
loaded via an explicit `@config` directive. There is none, so `tailwind.config.ts` is dead code.

Confirmed by grepping the compiled CSS in `.next/`: `bg-brand-blue`, `bg-brand-light`,
`text-brand-blue`, and `border-brand-blue/40` emit **no rules at all**. Only `brand-navy` survives,
because `globals.css:4` happens to redefine it — at `#0a192f`, a *different* value from the config's
`#0A0F2C`.

**Visible result in `DashboardShell.tsx`:**

| Line | Class | Actual result |
|---|---|---|
| `:200` | `bg-brand-blue` | "Add" button renders transparent |
| `:277` | `bg-brand-light` | Main panel has no background |
| `:142` | `bg-brand-blue/20` | Active-folder highlight invisible |
| `:162`, `:222` | `text-brand-blue` | Accent text unstyled |

**Fix:** move the palette into `@theme` in `globals.css` and delete `tailwind.config.ts`.

```css
@theme {
  --color-brand-blue:  #1847F0;
  --color-brand-navy:  #0A0F2C;
  --color-brand-light: #E8EEFF;
  --color-brand-muted: #6B7FCC;
  --font-sans: var(--font-dm-sans), sans-serif;
  --font-mono: var(--font-dm-mono), monospace;
}
```

The config's `content` globs are also wrong (`./app/**`, `./components/**` — everything lives under
`src/`), but that becomes moot once the file is deleted.

### 4. `text-xxl` and `text-regular` are not Tailwind classes

> **Status: FIXED.** Replaced with `text-2xl` and `text-base`. Verified by
> grepping the compiled CSS in `.next/`: both now emit real `font-size`/
> `line-height` rules, and `text-xxl`/`text-regular` no longer appear anywhere
> in the output.

**File:** `src/components/dashboard/DashboardShell.tsx:125-126` (sidebar logo)

Neither emits any CSS. Use `text-2xl` and `text-base`.

### 5. Password reset is a dead end

> **Status: FIXED.** Added `src/app/auth/reset/page.tsx`. It listens for the
> `PASSWORD_RECOVERY` auth event (fired once the Supabase browser client
> exchanges the recovery link's code for a session) and, once ready, shows a
> form that calls `supabase.auth.updateUser({ password })`. Verified with
> `npx tsc --noEmit` (clean), `npx next build` (the route now appears as a
> static `/auth/reset` page in the build output), and `npx eslint .`
> (still only the 2 pre-existing errors tracked as #10 — no new ones).

**File:** `src/app/auth/page.tsx:29`

`resetPasswordForEmail` sets `redirectTo: ${location.origin}/auth/reset`, but no such route exists —
`src/app/auth/` contains only `callback/`, `gmail/`, and `page.tsx`. Every reset email 404s.

**Fix:** add `src/app/auth/reset/page.tsx` that reads the recovery session and calls
`supabase.auth.updateUser({ password })`.

### 6. `?error=auth_callback_failed` is never displayed

> **Status: FIXED.** The auth page now reads the `error` query param via
> `useSearchParams` (wrapped in a `Suspense` boundary so `/auth` still
> prerenders statically) and shows a friendly message in the existing error
> slot, falling back to a generic message for any unrecognized error code.
> Verified with `npx tsc --noEmit` (clean), `npx next build` (`/auth` still
> shows as a static `○` route), and `npx eslint .` (still only the 2
> pre-existing errors tracked as #10 — no new ones).

**Files:** `src/app/auth/callback/route.ts:21`, `src/app/auth/page.tsx`

The callback redirects with that error parameter on failure, but the auth page never reads
`useSearchParams`. A failed Google sign-in silently returns the user to the login form with no
explanation.

### 7. Date handling uses UTC instead of local time

**Files:** `src/components/dashboard/ApplicationModal.tsx:39`, `src/components/dashboard/ApplicationsView.tsx:122`

```ts
date_applied: new Date().toISOString().split("T")[0]  // UTC date
```

In the Philippines (UTC+8), any application added **before 8 AM local time** is pre-filled with
*yesterday's* date. The same class of bug affects display: `new Date(app.date_applied)` parses a
bare `YYYY-MM-DD` `date` column as UTC midnight, which shifts the rendered day for any user in a
negative UTC offset.

**Fix:** build and format the date from local parts, without round-tripping through `Date`/`toISOString`.

### 8. Folder mutations fail silently

**File:** `src/components/dashboard/DashboardShell.tsx:69, 82, 105`

`createFolder`, `renameFolder`, and `deleteFolder` each guard with `if (!error)` and take no action
on the error branch. If a mutation fails, the UI simply doesn't change and the user is given no
indication why.

**Fix:** surface failures through the existing toast (generalise `gmailNotice` into a shared notice).

### 9. Avatar initial can throw on an empty email

**File:** `src/components/dashboard/DashboardShell.tsx:262`

```ts
user.email?.[0].toUpperCase()
```

The optional chain guards `email` being `undefined`, but not an empty string — `""[0]` is `undefined`,
and `.toUpperCase()` on it throws, crashing the sidebar. Use `user.email?.[0]?.toUpperCase()`.

---

## 🟡 Quality / correctness

### 10. Lint currently fails

`npx eslint .` reports 2 errors:

- `src/app/auth/page.tsx:137` — unescaped `'` (`react/no-unescaped-entities`).
- `src/components/dashboard/DashboardShell.tsx:43` — `react-hooks/set-state-in-effect`.

The second is a legitimate finding: the `?gmail=` parameter is read in an effect that then calls
`setState` synchronously, causing a cascading render. Read it during render or in the relevant
handler instead.

### 11. `hirewire_schema.sql` is not re-runnable

> **Status: FIXED.** The enum is wrapped in a `duplicate_object` guard and every
> policy and view is drop-guarded. Verified by applying the file three times in
> a row against PostgreSQL 16 with no errors.

The file's header instructs the reader to run it in the Supabase SQL Editor, but a second run fails:

- `create type public.app_status` (`:82`) — no `if not exists` support for types.
- All four `create policy` statements (`:123-140`) — error if the policy already exists.

**Fix:** wrap the enum in a `DO $$ ... EXCEPTION WHEN duplicate_object THEN NULL; $$` block, and
prefix each policy with `drop policy if exists`.

### 12. Missing index on the folder-page query

**File:** `src/app/dashboard/[folderId]/page.tsx:25`

The query filters on `folder_id` and orders by `date_applied`; no index covers it. The three existing
indexes target the reminder engine, the scanner, and folder listings.

```sql
create index if not exists idx_applications_folder_date
  on public.applications (folder_id, date_applied desc);
```

### 13. Add explicit user scoping as defense-in-depth

**Files:** `src/app/dashboard/layout.tsx:22`, `src/app/dashboard/[folderId]/page.tsx:19`

Both rely solely on RLS to scope rows. Adding `.eq("user_id", user.id)` costs nothing and provides
a second layer if a policy is ever changed incorrectly.

### 14. Two disconnected colour palettes

`DashboardShell` uses `brand-*` tokens; `EmptyFolders`, `ApplicationsView`, and `ApplicationModal`
use raw `blue-600` / `slate-*`. Standardise on the `@theme` tokens introduced in #3.

### 15. `/settings` is protected but does not exist

**File:** `middleware.ts:8`

`PROTECTED` lists `/settings`, which has no route. Harmless today; remove it or build the page.

### 16. Untyped status assignment

**File:** `src/components/dashboard/ApplicationModal.tsx:181`

`set("status", e.target.value)` passes a `string` into a field typed `AppStatus`. The computed-key
spread in `set()` widens the type, so TypeScript doesn't catch it. Narrow the setter's signature.

---

## ⚪ Not implemented

### 17. Phases 3 and 4 have no implementation in this repository

`docs/phases` describes a reminder engine (cron → Resend) and a Gmail scanner (Gmail API →
`status = 'Reply Received'`). Grepping `src/` for `gmail.googleapis`, `resend`, `cron`, and
`reminder_engine` returns nothing.

Current state:

- Connect Gmail stores a refresh token that nothing ever reads.
- Reminders never fire; `reminder_preference` is recorded but unused.
- `status` never auto-flips; `last_email_received` is never written.
- The sidebar tells the user *"Your inbox will be scanned daily"* (`DashboardShell.tsx:44`), which
  is not currently true.

This is the separate FastAPI service from the phases document. Until it exists, that toast copy
should be softened so the app doesn't promise behavior it doesn't have.

---

## Suggested order of work

1. **#1, #2** — security, before further public deployment.
2. **#3, #4, #5, #6, #7, #8, #9** — visibly broken functionality.
3. **#10 – #16** — quality pass.
4. **#17** — the Phase 3 / Phase 4 backend service.

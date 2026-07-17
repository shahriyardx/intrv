<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Intrv

AI-generated quizzes and interviews (MCQ, true/false, short answer). No code
execution.

## Access model — read this before touching a query

There is **no guest identity**: no guest cookie, no anonymous user row, nothing
to migrate at sign-up.

- A session created while signed out has `userId = null` and is readable by
  **anyone holding its id**. The random UUID in the URL *is* the capability,
  like an unlisted link. That is the product: no account, take the interview,
  read the result.
- A session created while signed in belongs to that user and nobody else — an
  anonymous visitor who learns the id still gets nothing.

`canAccessSession()` in `src/server/dal/owner.ts` is the one place that decides
this. `ownerWhere()` is only for *listing* a signed-in user's history and
returns `null` (never `{}`) for anonymous viewers.

## Admin

- **The first signed-in visitor to `/admin` claims it** (`getAdminViewer()` in
  `src/server/dal/admin.ts`), so a fresh install needs no hand-edited row. The
  claim runs under a Postgres advisory lock — under READ COMMITTED two
  simultaneous claimants would both see zero admins and both win. Once one
  admin exists it can never fire again. On a public deploy this is a land-grab:
  claim it immediately, or `bun run db:seed <email>` first.
- **`getAdminViewer()` claims; `isAdminUser()` does not.** Anything rendering on
  every page (the header) must use `isAdminUser()`, or it would promote whoever
  loaded the home page first.
- Admin role checks read the **database**, not the session cookie cache — that
  cache answers for 5 minutes, which would let a just-revoked admin keep reading
  and leave a just-claimed one seeing a 404.
- Non-admins get `notFound()`, never a 403 that confirms `/admin` exists. Note
  PPR flushes the shell before `notFound()` runs, so the status is 200 while the
  body is the 404 page; the body discloses nothing.

## Session modes — where the questions come from

`SessionMode` (schema enum) records *why* a session exists and, load-bearingly,
whether it generates live or replays a frozen set:

- **CUSTOM / JOB_DESCRIPTION / REVIEW generate live.** Created `status:
  GENERATING` with no Question rows; the tRPC `interview.generate` stream
  (`src/trpc/routers/interview.ts`) writes them as DeepSeek produces them.
  JOB_DESCRIPTION and REVIEW differ from CUSTOM *only* by a `brief` fed to the
  generator (the extracted JD profile / the due-concept list) — same live path,
  not a different one.
- **DAILY / REMATCH / ASSESSMENT are pre-seeded.** Created `status: READY` with
  Question rows already copied from a frozen source (`DailyChallenge.questions`,
  the source session's questions, `Assessment.questions`) and `startedAt`/`expiresAt`
  set at creation. The runner's `generate` query sees `status !== GENERATING`
  and **replays from the DB** — it never calls the model. Do not "fix" one of
  these by setting it GENERATING: that regenerates and defeats the point (every
  taker must answer the *identical* set).

The frozen JSON these three copy from carries **answer keys** and is
`server-only` in every case. Never `select` it into anything client-bound; the
copy into Question rows happens entirely server-side.

## Adaptive sessions

`InterviewSession.adaptive` switches `interview.generate` from `streamStandard`
to `streamAdaptive`. The stepping/calibration math lives in
`src/server/ai/adaptive.ts` (import-free, unit-tested) and is the single source
of truth.

- Generated in **batches of 3** (`ADAPTIVE_BATCH`). Between batches it waits for
  that batch's objective (MCQ/TRUE_FALSE) answers, grades them **server-side
  against the stored key** (the key never leaves the server), and steps the
  rung: `≥ 2/3` correct → up, `≤ 1/3` → down, else hold; a batch with no
  answered objective questions holds (never guess a direction from nothing).
- The wait is polled, **capped at 15 min** (`ANSWER_WAIT_CAP_MS`), and abortable
  — a student who walks away proceeds at the same rung rather than hanging.
- **The clock starts at the first batch**, not when the whole set exists
  (`startedAt`/`expiresAt` are set on the first yield). Otherwise a timed
  adaptive session never ticks while it waits for answers.
- `Question.difficulty` is the **per-question rung**; `null` means "the session's
  difficulty" (non-adaptive). The result page reads it via `calibratedLevel()`.

## Learning loop (spaced repetition)

`submitSession` calls `afterSessionGraded` (`src/server/learning/hooks.ts`) once
a session reaches GRADED, **inside a try/catch — it never throws outward.** A
learning-loop failure must not cost the student their result. It delegates to
`scheduleReviews` (`src/server/learning/reviews.ts`):

- A normal graded session **creates work**: each missed concept becomes (or
  resets to) a stage-0 `ReviewItem` due in 1 day. "Missed" = unanswered,
  `isCorrect = false`, or score `< 60` (the same floor submitSession uses).
- A REVIEW session **resolves work**: a concept answered cleanly climbs the
  `1d → 3d → 7d` ladder then retires; a re-miss resets it and counts a lapse.
- Items are keyed `@@unique([userId, topic, concept])`; the active queue is
  capped at **200** per user (`capActiveItems` retires the longest-overdue
  overflow).
- **Anonymous and ASSESSMENT sessions no-op** — neither feeds a signed-in user's
  study loop.

## Daily challenge

One shared `DailyChallenge` row per **UTC day** (`dateKey` = `YYYY-MM-DD`,
unique). `getOrCreateDailyChallenge` (`src/server/dal/daily.ts`) fast-paths a
lookup; only the day's first *player* generates, behind
`pg_advisory_xact_lock(84749, 2012)` — the **admin claim is (84749, 2011)**, and
the int4-pair form is mandatory because this target is ES2017 (**no BigInt
literals**). Generation runs **inside the txn**, holding the lock for its full
~60–120s (txn `timeout` raised to 200s): once per UTC day, everyone else
fast-paths or waits behind it exactly once. `getTodayDailyChallenge` is
read-only, so a `/daily` GET never generates. `DailyChallenge.questions` carries
answer keys → server-only.

## Organizations & account types

An account is **personal** or **organization**, chosen at sign-up and mutually
exclusive — the two surfaces never overlap.

- **Account type is derived, not a column.** An org account is one with an org
  membership; `getActiveOrg()`/`isOrgAccount()` in `src/server/dal/org.ts` are
  the source of truth. `session.activeOrganizationId` (the better-auth plugin
  field) names the active org, but **the cookie value is a claim, not proof** —
  the 5-minute session cache can lag (same trap as admin roles). Every org read
  resolves the `Member` row by `(userId, activeOrganizationId)` **in the DB per
  request** and treats a missing/mismatched row as not-a-member; it falls back
  to the user's single membership rather than trust the cookie. Never authorize
  from `activeOrganizationId` alone.
- **One org per user, created only at sign-up.** `createOrganization` rejects a
  second org (`code: "has_org"`); there is no other creation path. The sign-up
  form's Organization choice runs `signUp` → `createOrganization` → sets
  `activeOrganizationId` → `/org`. If `signUp` hits "user already exists" on the
  org path it's a stranded retry: sign in with the same creds, then continue to
  org creation (or route to `/org` if they already have one).
- **Routes are slug-free.** `/org` is the single active-org dashboard; screens
  live at `/org/screens/new`, `/org/screens/[screenId]`, and
  `/org/screens/[screenId]/c/[sessionId]`. There is no `/org/[slug]`.
- **The account gate is per-surface, and `/s/*` is exempt — deliberately.**
  `OrgAccountGate` (a Suspense-sibling redirect to `/org`) is mounted only on
  the personal pages that have an org mirror: `dashboard/layout.tsx`,
  `start/page.tsx`, `daily/page.tsx`. It is **not** on an `(app)` layout, because
  `/s/[sessionId]` and its result live under `(app)`: a signed-in org user can
  legitimately *take* another org's screen or a challenge link, and gating the
  runner would yank them to `/org` mid-interview and eat the session. The mirror
  gate in `(org)/org/layout.tsx` sends personal accounts to `/dashboard`.
- **Known gap: OAuth users are personal-only.** The account-type choice lives on
  the email/password form; a Google sign-up can't pick Organization, so those
  accounts are permanently personal. A product decision (let them convert, or
  add the choice to the OAuth flow), not yet made — don't invent a fix.

Screening access mirrors `/admin`'s non-disclosure doctrine: `src/server/dal/org.ts`
resolves the viewer's `Member` role first and returns **null (→ `notFound()`),
never a 403**, for non-members.

- **Candidates must sign in.** `/i/[token]` redirects a signed-out visitor to
  `/sign-in?next=/i/<token>` **before** it looks the token up, so a stranger
  can't use the route to test whether a token is real. `candidateName` /
  `candidateEmail` are read from the session inside `startAssessmentSession`,
  which takes **no FormData at all** — a typed-in name would let someone sit an
  assessment as another person, which is the one claim the report has to be able
  to make truthfully. They stay denormalized on the attempt so the report
  survives a rename or a deleted account.
- `Assessment.questions` is the frozen set **with answer keys** → server-only. The
  candidate view (`getAssessmentByInviteToken`) never selects it.
- **Candidates must not see their own score.** The ASSESSMENT result page gates
  on `getAssessmentGate`; only an org member sees the graded result.
- `integrity` (focus-loss / paste counters) is a **client-reported signal only**,
  stored for `mode ASSESSMENT` only, re-validated with `integritySchema` on read,
  and shown only to org members.

## Leaderboard, XP & naming

- **`mode ASSESSMENT` is excluded everywhere points are computed** — a screening
  attempt is a recruiter's private process, not play. `leaderboard.ts` is the
  source of truth (both `getLeaderboard` and `getViewerStanding` filter
  `mode != 'ASSESSMENT'`); the XP/streak DAL (`src/server/dal/learning.ts`) reuses
  the exported `DIFFICULTY_MULTIPLIER` so the two formulas can't drift, and
  excludes ASSESSMENT too.
- **A taker is named only when `user` exists AND `!banned` AND
  `!leaderboardOptOut`** — otherwise the surface shows "Anonymous"/"Someone".
  This three-part rule is deliberately duplicated across daily standings
  (`daily.ts`), the challenge/rematch pages (`challenge.ts`), and the share badge
  (`share.ts`). Change one, check the others.

## Stack

Next 16.2.10 (App Router, `cacheComponents: true`) · React 19.2 · tRPC v11 ·
Prisma 7 + `@prisma/adapter-pg` · better-auth 1.6 · Zod v4 · Tailwind v4 +
shadcn · Biome · Bun · DeepSeek.

## Commands

```bash
bun run db:up        # Postgres 18 in Docker on :5433 (5432 is another project)
bun run dev
bun run lint         # biome
bun run typecheck
bun run test         # vitest
```

## Things that will bite you

These are all verified against the installed packages — not guesses.

- **Prisma 7 has no Rust engine.** A driver adapter is mandatory: bare
  `new PrismaClient()` throws. Always import the singleton from `src/lib/db.ts`.
- **`url` is banned from `schema.prisma`.** It lives in `prisma.config.ts`,
  which needs `import "dotenv/config"` because Prisma 7 no longer auto-loads
  `.env` for the CLI.
- **A stale generated Prisma client is the single most misleading failure here,
  and it has bitten twice.** It surfaces as `Model X does not exist in the
  database` or `The column X does not exist in the current database` — both of
  which read like a migration problem and are not. `next dev` caches the
  generated client module, so **after every `prisma migrate dev` you must
  restart the dev server**, not just regenerate. `dev` and `postinstall` both
  run `prisma generate` to cover the cold-start case; nothing can cover the
  mid-session one but a restart.
- **`revalidateTag(tag)` needs a second arg** (a cacheLife profile) in Next 16.
  Prefer `updateTag` in Server Actions for read-your-own-writes.
- **`middleware.ts` is now `proxy.ts`**, Node runtime, not configurable. It is
  *not* an auth boundary and does no session work. Real authorization lives in
  the DAL and is re-checked inside every Server Action, because Server Functions
  are POST endpoints reachable directly. Ours does exactly one thing: stamp
  `x-pathname` on the request so a layout's auth gate can send a signed-out
  visitor back to the child page they asked for (a layout renders for all its
  children and cannot otherwise know which). It **clones-then-sets**, so a
  spoofed client `x-pathname` is overwritten — but that only holds on paths its
  matcher covers, which is why `signInHere()` still runs the value through
  `safeNextPath`. Redirect-target logic lives in `src/lib/next-path.ts`, kept
  import-free (like `owner.ts`) so both the client forms and the server gates
  share one implementation and it stays unit-testable.
- **`forbidden()`/`unauthorized()` are experimental** (need
  `experimental.authInterrupts`). Use `redirect()`.
- **Parallel route slots require `default.tsx`** or the build fails.
- **Typed routes go stale mid-session.** A newly added route makes `next`'s
  `Link`/`redirect()` reject its *own* href — `tsc` fails on `href="/new-route"`
  until `.next/types/routes.d.ts` is regenerated by `next build` or a dev-server
  restart. A running `next dev` compiles and serves the new route (200) but does
  **not** rewrite that types file. It is not a code bug and casting it away is
  wrong; it clears at the next build/restart.
- **`_folder` is private and non-routable.** Use `(group)` for organization.
- **better-auth: `nextCookies()` must be last** in the plugins array, or cookies
  set during Server Actions are silently dropped.
- **The better-auth CLI can't parse a config that imports `server-only`.** Our
  `auth.ts` imports `db.ts` which does. Maintain plugin fields in
  `prisma/schema.prisma` by hand and verify with a real signup. This includes
  the `organization` plugin's tables: `Organization`/`Member`/`Invitation` (each
  `@@map`ped to its better-auth model name — `member`, `invitation`) and
  `Session.activeOrganizationId`. The model/field names are load-bearing — the
  Prisma adapter resolves better-auth's `organization`/`member`/`invitation`
  models to `prisma.organization`/`prisma.member`/`prisma.invitation`, so
  don't rename them. Orgs have no `ownerId` column; ownership is the `Member`
  with role `owner` that the plugin creates for the creator. The "3 owned orgs"
  cap and slug `-2`/`-3` suffixing live in `src/server/actions/org.ts` on top of
  `auth.api.createOrganization`, which otherwise just rejects a taken slug.

### tRPC + cacheComponents (verified by spike, 2026-07-16)

React Query's `dehydrate()` calls `Date.now()`, which Next rejects during a
prerender when `cacheComponents` is on. Upstream closed this as working-as-
designed (TanStack/query#9457, #9499), and the commonly-cited
`staleTime: 'static'` workaround does **not** fix it on its own — we tried.

What actually works: `HydrateClient` in `src/trpc/server.tsx` awaits
`connection()` before dehydrating, which marks it request-time. Note that
`<Suspense>` alone does not opt a component into dynamic rendering — it only
supplies a fallback. Callers must still wrap `HydrateClient` in `<Suspense>` to
keep the route's static shell. Never call it under `use cache`.

### Streaming

A tRPC `query` can be an async generator; `useQuery` then returns a growing
typed array that re-renders per `yield` (verified: 7 distinct render states).
Use it via the `stream: true` context flag, which routes through
`httpBatchStreamLink` in `src/trpc/client.tsx`. Don't hand-roll SSE.

Streaming links cannot set headers/cookies once the stream begins — that's why
non-streaming calls stay on `httpBatchLink`.

## Conventions

- `src/server/dal/*` and `src/lib/{db,auth,env}.ts` are `server-only`.
  `src/server/dal/owner.ts` is the exception and stays import-free so the access
  rules are unit-testable without a database.
- **DAL for RSC reads, tRPC for the client-facing API, Server Actions for
  mutations.** Don't route RSC data through tRPC — `createCaller` re-runs
  context, middleware, and validation for code the DAL already exposes.
- **Field forms are react-hook-form + `zodResolver` + shadcn `Field`
  (`src/components/ui/field.tsx`) on the client, submitting to the same
  zod-validated Server Action (or `authClient` for auth).** This makes them
  JS-required — a deliberate trade for inline field validation and error UX.
  RHF's client validation is UX only, **never** the security boundary: the
  Server Action re-validates everything with the same zod schema, so never
  weaken a server-side check to lean on the client. Labels wrap `DataLabel`
  inside `FieldLabel` to keep the mono look; the action-level error line stays
  for server-only failures (slug collisions, AI failures). Single-button action
  forms stay native `<form action={…}>`.
- **RHF v7 + `reactCompiler: true` needs `"use no memo"`.** react-hook-form
  tracks `formState`/`watch` through a Proxy; the React Compiler optimizes those
  accesses away, so error and `isSubmitting` changes never re-render and field
  errors silently never show. Every component that calls `useForm`/
  `useFormContext` and reads `formState`/`watch` opens with the `"use no memo"`
  directive. Remove it when RHF v8 (compiler-aware) lands. Also: RHF's
  `handleSubmit` awaits async validation before your handler runs, by which
  point React has nulled the submit event's `currentTarget` — build FormData
  from a stable `useRef` on the `<form>`, never `event.currentTarget`.
- Server Functions are POST endpoints reachable directly, so **every action
  re-establishes its viewer and re-checks access** rather than trusting the UI
  that called it.
- `Question.answerKey` and `explanation` must never reach the client before
  grading. Go through the DAL's `toClientQuestion()` DTO.
- Money and scores are `Decimal`, never `Float`. JSON columns are `JsonB`.
- Fonts: Newsreader = editorial display, Geist Sans = body/UI, JetBrains Mono =
  data. Chart hues in `globals.css` are validated against our exact surfaces —
  don't hand-tune them.

# Intrv

Practice interviews that tell you what to fix.

Pick any topic — or paste a job description and we read the role, stack and
seniority out of it — then DeepSeek writes the questions. They stream in as they
are written, so you start answering in seconds. Multiple choice and true/false
are graded instantly on our own server; short answers go to the model, which
awards partial credit and says what was missing. Every question is tagged with
the concepts behind it, so the result is a reading list rather than a number.
Turn on adaptive difficulty and the questions step up or down as you answer,
ending on a calibrated level ("strong at medium, shaky at hard") instead of a
bare percentage.

No account is needed to take an interview and read the result — the URL is your
way back to it.

There is no code execution. Code questions are read, not run: "what does this
print" with a syntax-highlighted snippet, answered by picking or writing.

## What signing in adds

Signing in turns a one-off result into a loop. Every miss is logged as a concept
and rescheduled as a *fresh* question a day later, then three, then a week
(spaced repetition); a mastery map ranks every concept weakest-first across
everything you've taken; and a study plan turns that into what to practise next.
You also get a full history, a mistakes review across sessions, a streak and XP,
and a spot on the public leaderboard (opt-out). Any missed question opens a
follow-up chat with a teacher persona — the score stays final. Race a friend by
sharing a graded result as a challenge: they take the identical question set and
the result shows the two of you head to head. And there's a daily challenge —
one shared ten-question set per UTC day, one attempt per account, with its own
board.

## For teams

`/org` is the screening side. Create an organization, generate one frozen
screening interview, and send every candidate the same capability link — no
account needed on their end. Reports show score, duration, and integrity signals
(tab-switches, pastes); candidates never see their score, recruiters do.

## Running it

Requires [Bun](https://bun.sh) and Docker.

```bash
bun install
cp .env.example .env     # then fill in the values below
bun run db:up            # Postgres 18 in Docker on :5433
bun run db:migrate
bun run dev
```

`.env` needs, at minimum:

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Matches `docker-compose.yml`. Port **5433**, not 5432. |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | `http://localhost:3000` locally. Also the origin used for `metadataBase` and the sitemap. |
| `DEEPSEEK_API_KEY` | From [platform.deepseek.com](https://platform.deepseek.com/api_keys). Without it, generation and short-answer grading fail; everything else works. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional. The Google button only appears when both are set. Redirect URI: `<BETTER_AUTH_URL>/api/auth/callback/google`. |

### Becoming an admin

The first signed-in visitor to `/admin` claims it — no database editing. Once an
admin exists this can never fire again.

**On a public deployment this is a land-grab**: whoever reaches `/admin` first
becomes the operator. Claim it immediately after deploying, or seed one first:

```bash
bun run db:seed you@example.com
```

## Commands

```bash
bun run dev          # prisma generate + next dev
bun run build        # production build
bun run lint         # biome
bun run typecheck    # tsc --noEmit
bun run test         # vitest
bun run db:up        # start Postgres
bun run db:migrate   # prisma migrate dev
bun run db:studio    # prisma studio
bun run db:seed      # promote a user to admin by email
```

## Stack

Next 16 (App Router, `cacheComponents`) · React 19 · TypeScript · tRPC v11 ·
Prisma 7 + `@prisma/adapter-pg` · Postgres 18 · better-auth · Zod v4 ·
Tailwind v4 + shadcn · Biome · Vitest + Playwright · DeepSeek.

## How it fits together

```
src/
  app/
    (marketing)/    home, about, blog, contact, leaderboard, privacy, terms
    (auth)/         sign-in, sign-up
    (app)/          start (topic or job description), s/[sessionId] (the runner),
                    daily (the shared daily challenge),
                    dashboard (overview, review, plan, analytics, history,
                    mistakes, settings)
    (org)/org/      organizations: screens and candidate reports
    (admin)/admin/  users, sessions, posts, messages, ai-usage
    r/[shareId]/    public shared result
    challenge/[shareId]/  take a friend's shared set, scored head-to-head
    i/[token]/      candidate capability link into an org screen
  server/
    dal/            server-only reads. Access rules live in owner.ts;
                    learning, daily, challenge, org, analytics live here too
    actions/        Server Actions (mutations)
    ai/             DeepSeek client, prompts, generation, grading, JD extraction
    grading/        local MCQ / true-false grading
    learning/       spaced-repetition scheduling and streak/XP math
  trpc/             the client-facing API (question streaming)
```

Reads go through the DAL, mutations through Server Actions, and tRPC carries the
one thing that genuinely needs it: streaming questions to the browser as they
are generated.

`AGENTS.md` documents the conventions and — more usefully — the traps that have
already cost real time in this codebase. Read it before changing anything.

## Things worth knowing

- **`answerKey` must never reach the client before a session is graded.** Every
  question crosses the wire through `toClientQuestion(row, revealAnswers)`. This
  is the one invariant that is not recoverable if broken.
- **There is no guest identity.** A signed-out session has `userId = null` and is
  readable by anyone holding its id — the UUID *is* the capability. A signed-in
  session belongs to that user alone. `canAccessSession()` decides both.
- **After `prisma migrate`, restart the dev server.** A stale generated client
  reports `column does not exist`, which reads exactly like a broken migration
  and is not.
- Costs are tracked per model call in the `ai_call` table and shown in
  `/admin/ai-usage`. The cache-hit ratio is the lever: hits are ~50x cheaper than
  misses, which is why the prompts are prefix-stable.

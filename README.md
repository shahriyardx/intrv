# Intrv

Practice interviews that tell you what to fix.

Pick any topic, pick a difficulty and a length, and DeepSeek writes the
questions. They stream in as they are written, so you start answering in
seconds. Multiple choice and true/false are graded instantly on our own server;
short answers go to the model, which awards partial credit and says what was
missing. Every question is tagged with the concepts behind it, so the result is
a reading list rather than a number.

No account is needed to take an interview and read the result — the URL is your
way back to it. Signing in adds history, a mistakes review across every session,
analytics, and a place on the leaderboard.

There is no code execution. Code questions are read, not run: "what does this
print" with a syntax-highlighted snippet, answered by picking or writing.

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
    (app)/          start, s/[sessionId] (the runner), dashboard
    (admin)/admin/  users, sessions, posts, messages, ai-usage
    r/[shareId]/    public shared result
  server/
    dal/            server-only reads. Access rules live in owner.ts
    actions/        Server Actions (mutations)
    ai/             DeepSeek client, prompts, generation, grading
    grading/        local MCQ / true-false grading
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

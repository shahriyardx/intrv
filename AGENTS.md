<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# InterviewAI

AI-generated quizzes and interviews (MCQ, true/false, short answer). Guests can
play without an account; signing up adopts their history. No code execution.

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
- **A stale generated client fails as `Model X does not exist in the database`**,
  which sounds like a migration problem and isn't. Run `bun run db:generate`.
  `postinstall` does it for fresh clones. Restart `next dev` after generating —
  it caches the client module.
- **`revalidateTag(tag)` needs a second arg** (a cacheLife profile) in Next 16.
  Prefer `updateTag` in Server Actions for read-your-own-writes.
- **`middleware.ts` is now `proxy.ts`**, Node runtime, not configurable. It is
  *not* an auth boundary — it does cosmetic redirects only. Real authorization
  lives in the DAL and is re-checked inside every Server Action, because Server
  Functions are POST endpoints reachable directly.
- **`forbidden()`/`unauthorized()` are experimental** (need
  `experimental.authInterrupts`). Use `redirect()`.
- **Parallel route slots require `default.tsx`** or the build fails.
- **`_folder` is private and non-routable.** Use `(group)` for organization.
- **better-auth: `nextCookies()` must be last** in the plugins array, or cookies
  set during Server Actions are silently dropped.
- **The better-auth CLI can't parse a config that imports `server-only`.** Our
  `auth.ts` imports `db.ts` which does. Maintain plugin fields in
  `prisma/schema.prisma` by hand and verify with a real signup.

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

- `src/server/dal/*` and `src/lib/{db,auth,env,guest}.ts` are `server-only`.
- **DAL for RSC reads, tRPC for the client-facing API, Server Actions for
  mutations/forms.** Don't route RSC data through tRPC — `createCaller` re-runs
  context, middleware, and validation for code the DAL already exposes.
- `Question.answerKey` and `explanation` must never reach the client before
  grading. Go through the DAL's `toClientQuestion()` DTO.
- Money and scores are `Decimal`, never `Float`. JSON columns are `JsonB`.
- Fonts: Newsreader = editorial display, Geist Sans = body/UI, JetBrains Mono =
  data. Chart hues in `globals.css` are validated against our exact surfaces —
  don't hand-tune them.

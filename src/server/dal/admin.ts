import "server-only";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  type ClientQuestion,
  clientQuestionSelect,
  toClientQuestion,
} from "@/server/dal/dto";
import { getViewer } from "@/server/dal/session";

export type AdminViewer = { userId: string };

/**
 * Arbitrary but fixed: the (classid, objid) two concurrent claimants serialize
 * on. The int4 pair form avoids a BigInt literal, which this tsconfig target
 * cannot express.
 */
const ADMIN_CLAIM_LOCK = [84_749, 2_011] as const;

/**
 * Bootstrap: the first signed-in visitor to /admin claims it, so a fresh
 * install has an operator without anyone hand-editing the database.
 *
 * The window is exactly "no admin exists yet" — once one does, this can never
 * promote anyone again, and role changes go through the admin UI.
 *
 * SECURITY: on a public deployment this is a land-grab — whoever reaches /admin
 * first becomes the operator, and that need not be the person who deployed it.
 * Claim it immediately after deploying, or seed an admin first
 * (`bun run db:seed <email>`).
 *
 * The advisory lock is not ceremony: under READ COMMITTED two simultaneous
 * claimants would both see zero admins and both be promoted.
 */
async function claimAdminIfUnclaimed(userId: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ADMIN_CLAIM_LOCK[0]}, ${ADMIN_CLAIM_LOCK[1]})`;

    const admins = await tx.user.count({ where: { role: "admin" } });
    if (admins > 0) return false;

    await tx.user.update({ where: { id: userId }, data: { role: "admin" } });
    return true;
  });
}

/**
 * The gate for admin *reads*. Returns null rather than throwing so callers pick
 * their own disclosure: every page turns null into notFound(), because a 403
 * would confirm that /admin exists to anyone who guesses the URL.
 *
 * The role comes from the database rather than the session cookie cache. That
 * cache answers for up to 5 minutes, which would mean a just-claimed admin
 * still gets a 404 and a just-revoked one keeps reading — neither is acceptable
 * on this surface, and an admin page can afford the query.
 */
export async function getAdminViewer(): Promise<AdminViewer | null> {
  const viewer = await getViewer();
  if (viewer.kind !== "user") return null;

  const user = await prisma.user.findUnique({
    where: { id: viewer.userId },
    select: { role: true, banned: true },
  });

  if (!user || user.banned) return null;
  if (user.role === "admin") return { userId: viewer.userId };

  return (await claimAdminIfUnclaimed(viewer.userId))
    ? { userId: viewer.userId }
    : null;
}

/**
 * Read-only role check for gating UI, e.g. whether to render the Admin link.
 *
 * Deliberately separate from getAdminViewer: that one *claims* an unclaimed
 * admin seat, and the header renders on every page — wiring it there would
 * promote whoever loaded the home page first.
 */
export async function isAdminUser(): Promise<boolean> {
  const viewer = await getViewer();
  if (viewer.kind !== "user") return false;

  const user = await prisma.user.findUnique({
    where: { id: viewer.userId },
    select: { role: true, banned: true },
  });

  return user?.role === "admin" && !user.banned;
}

/**
 * The gate for admin *writes*. Re-reads the session with the cookie cache
 * disabled, so a just-revoked or just-banned admin cannot keep acting for the
 * cache's lifetime. Mirrors adminProcedure in src/trpc/init.ts.
 *
 * Every action calls this itself. Server Functions are POST endpoints reachable
 * directly, so the page that rendered the button proves nothing.
 */
export async function requireFreshAdmin(): Promise<AdminViewer | null> {
  const fresh = await auth.api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  });

  if (!fresh || fresh.user.role !== "admin" || fresh.user.banned) return null;
  return { userId: fresh.user.id };
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

export type Overview = {
  users: number;
  sessions: number;
  gradedSessions: number;
  /** Share of all sessions that reached GRADED, 0-1. Null when there are none. */
  completionRate: number | null;
  spendToday: number;
  spend7d: number;
  spend30d: number;
  calls30d: number;
  /** Share of AI calls in the last 30 days that failed, 0-1. Null when none. */
  failureRate: number | null;
};

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/**
 * UTC, deliberately. Postgres `date_trunc('day', ...)` buckets in the session
 * timezone (UTC), so the series must be keyed in UTC too — mixing the two
 * silently files calls near midnight under the wrong day and leaves series keys
 * that match no bucket at all.
 */
function startOfToday(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

async function spendSince(since: Date): Promise<number> {
  const agg = await prisma.aiCall.aggregate({
    where: { createdAt: { gte: since } },
    _sum: { costUsd: true },
  });
  return Number(agg._sum.costUsd ?? 0);
}

export async function getOverview(): Promise<Overview> {
  const [users, sessions, gradedSessions, today, week, month, calls, failures] =
    await Promise.all([
      prisma.user.count(),
      prisma.interviewSession.count(),
      prisma.interviewSession.count({ where: { status: "GRADED" } }),
      spendSince(startOfToday()),
      spendSince(daysAgo(7)),
      spendSince(daysAgo(30)),
      prisma.aiCall.count({ where: { createdAt: { gte: daysAgo(30) } } }),
      prisma.aiCall.count({
        where: { createdAt: { gte: daysAgo(30) }, ok: false },
      }),
    ]);

  return {
    users,
    sessions,
    gradedSessions,
    completionRate: sessions === 0 ? null : gradedSessions / sessions,
    spendToday: today,
    spend7d: week,
    spend30d: month,
    calls30d: calls,
    failureRate: calls === 0 ? null : failures / calls,
  };
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export type AdminUserRow = {
  id: string;
  email: string;
  name: string;
  role: string | null;
  banned: boolean;
  banReason: string | null;
  banExpires: Date | null;
  sessionsTaken: number;
  createdAt: Date;
};

export const USERS_PAGE_SIZE = 25;

export async function listAdminUsers(opts: {
  query?: string;
  page?: number;
}): Promise<{ rows: AdminUserRow[]; total: number; page: number }> {
  const page = Math.max(1, opts.page ?? 1);
  const query = opts.query?.trim();

  const where = query
    ? {
        OR: [
          { email: { contains: query, mode: "insensitive" as const } },
          { name: { contains: query, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * USERS_PAGE_SIZE,
      take: USERS_PAGE_SIZE,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        banned: true,
        banReason: true,
        banExpires: true,
        createdAt: true,
        _count: { select: { interviewSessions: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    rows: rows.map(({ _count, banned, ...row }) => ({
      ...row,
      banned: Boolean(banned),
      sessionsTaken: _count.interviewSessions,
    })),
    total,
    page,
  };
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export type SessionStatus =
  | "GENERATING"
  | "READY"
  | "SUBMITTED"
  | "GRADED"
  | "FAILED"
  | "ABANDONED";

export const SESSION_STATUSES: readonly SessionStatus[] = [
  "GENERATING",
  "READY",
  "SUBMITTED",
  "GRADED",
  "FAILED",
  "ABANDONED",
];

export type AdminSessionRow = {
  id: string;
  topic: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  status: SessionStatus;
  /** null means the session was taken signed-out and belongs to nobody. */
  ownerEmail: string | null;
  score: number | null;
  questionCount: number;
  createdAt: Date;
};

export const SESSIONS_PAGE_SIZE = 25;

export async function listAdminSessions(opts: {
  status?: SessionStatus;
  page?: number;
}): Promise<{ rows: AdminSessionRow[]; total: number; page: number }> {
  const page = Math.max(1, opts.page ?? 1);
  const where = opts.status ? { status: opts.status } : {};

  const [rows, total] = await Promise.all([
    prisma.interviewSession.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * SESSIONS_PAGE_SIZE,
      take: SESSIONS_PAGE_SIZE,
      select: {
        id: true,
        topic: true,
        difficulty: true,
        status: true,
        score: true,
        questionCount: true,
        createdAt: true,
        user: { select: { email: true } },
      },
    }),
    prisma.interviewSession.count({ where }),
  ]);

  return {
    rows: rows.map(({ user, score, ...row }) => ({
      ...row,
      ownerEmail: user?.email ?? null,
      score: score === null ? null : Number(score),
    })),
    total,
    page,
  };
}

export type AdminSessionDetail = AdminSessionRow & {
  error: string | null;
  questions: ClientQuestion[];
  aiCalls: {
    id: string;
    model: string;
    purpose: string;
    costUsd: number;
    latencyMs: number;
    ok: boolean;
    errorCode: string | null;
    attempts: number;
    createdAt: Date;
  }[];
};

/**
 * Operational detail for one session.
 *
 * Being an admin does not mean seeing answer keys early: revealAnswers follows
 * the session's own status exactly as it does for the person taking it. An
 * admin with a live session open is still a browser that could be shoulder-read,
 * and the rule is that the key does not exist client-side before grading.
 */
export async function getAdminSessionDetail(
  sessionId: string,
): Promise<AdminSessionDetail | null> {
  const session = await prisma.interviewSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      topic: true,
      difficulty: true,
      status: true,
      score: true,
      questionCount: true,
      createdAt: true,
      error: true,
      user: { select: { email: true } },
      questions: { orderBy: { index: "asc" }, select: clientQuestionSelect },
      aiCalls: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          model: true,
          purpose: true,
          costUsd: true,
          latencyMs: true,
          ok: true,
          errorCode: true,
          attempts: true,
          createdAt: true,
        },
      },
    },
  });

  if (!session) return null;

  const revealAnswers = session.status === "GRADED";

  return {
    id: session.id,
    topic: session.topic,
    difficulty: session.difficulty,
    status: session.status,
    ownerEmail: session.user?.email ?? null,
    score: session.score === null ? null : Number(session.score),
    questionCount: session.questionCount,
    createdAt: session.createdAt,
    error: session.error,
    questions: session.questions.map((q) => toClientQuestion(q, revealAnswers)),
    aiCalls: session.aiCalls.map((call) => ({
      ...call,
      costUsd: Number(call.costUsd),
    })),
  };
}

// ---------------------------------------------------------------------------
// AI usage
// ---------------------------------------------------------------------------

export type AiDay = {
  day: string;
  costUsd: number;
  calls: number;
  failures: number;
  cacheHitTokens: number;
  cacheMissTokens: number;
};

export type AiUsage = {
  days: AiDay[];
  totals: {
    calls: number;
    costUsd: number;
    cacheHitTokens: number;
    cacheMissTokens: number;
    outputTokens: number;
    /** Hits over prompt tokens, 0-1. Null when nothing was sent. */
    cacheHitRatio: number | null;
  };
  latency: { p50: number | null; p95: number | null };
  failures: { errorCode: string; calls: number }[];
  byModel: { model: string; calls: number; costUsd: number }[];
  byPurpose: { purpose: string; calls: number; costUsd: number }[];
};

type RawDay = {
  day: Date;
  cost: unknown;
  calls: bigint;
  failures: bigint;
  hit: bigint | null;
  miss: bigint | null;
};

type RawLatency = { p50: number | null; p95: number | null };

/** UTC key, matching `date_trunc('day', ...)`. See startOfToday(). */
function dayKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function getAiUsage(days = 14): Promise<AiUsage> {
  const since = new Date(startOfToday().getTime() - (days - 1) * 86_400_000);

  const [raw, totals, latency, failures, byModel, byPurpose] =
    await Promise.all([
      // date_trunc has no Prisma groupBy equivalent, and bucketing in JS would
      // mean pulling every row for the window.
      prisma.$queryRaw<RawDay[]>`
        select
          date_trunc('day', "createdAt") as day,
          sum("costUsd") as cost,
          count(*) as calls,
          count(*) filter (where not ok) as failures,
          sum("promptCacheHitTokens") as hit,
          sum("promptCacheMissTokens") as miss
        from ai_call
        where "createdAt" >= ${since}
        group by 1
        order by 1
      `,
      prisma.aiCall.aggregate({
        where: { createdAt: { gte: since } },
        _count: { _all: true },
        _sum: {
          costUsd: true,
          promptCacheHitTokens: true,
          promptCacheMissTokens: true,
          outputTokens: true,
        },
      }),
      prisma.$queryRaw<RawLatency[]>`
        select
          percentile_cont(0.5) within group (order by "latencyMs") as p50,
          percentile_cont(0.95) within group (order by "latencyMs") as p95
        from ai_call
        where "createdAt" >= ${since} and ok
      `,
      prisma.aiCall.groupBy({
        by: ["errorCode"],
        where: { createdAt: { gte: since }, ok: false },
        _count: { _all: true },
        orderBy: { _count: { errorCode: "desc" } },
      }),
      prisma.aiCall.groupBy({
        by: ["model"],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
        _sum: { costUsd: true },
      }),
      prisma.aiCall.groupBy({
        by: ["purpose"],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
        _sum: { costUsd: true },
      }),
    ]);

  const byDay = new Map(
    raw.map((row) => [
      dayKey(row.day),
      {
        costUsd: Number(row.cost ?? 0),
        calls: Number(row.calls),
        failures: Number(row.failures),
        cacheHitTokens: Number(row.hit ?? 0),
        cacheMissTokens: Number(row.miss ?? 0),
      },
    ]),
  );

  // Every day in the window gets a bucket: a gap in a spend chart must read as
  // zero spend, not as a day that never happened.
  const series: AiDay[] = Array.from({ length: days }, (_, i) => {
    const date = new Date(since.getTime() + i * 86_400_000);
    const key = dayKey(date);
    return {
      day: key,
      ...(byDay.get(key) ?? {
        costUsd: 0,
        calls: 0,
        failures: 0,
        cacheHitTokens: 0,
        cacheMissTokens: 0,
      }),
    };
  });

  const hitTokens = totals._sum.promptCacheHitTokens ?? 0;
  const missTokens = totals._sum.promptCacheMissTokens ?? 0;
  const promptTokens = hitTokens + missTokens;

  return {
    days: series,
    totals: {
      calls: totals._count._all,
      costUsd: Number(totals._sum.costUsd ?? 0),
      cacheHitTokens: hitTokens,
      cacheMissTokens: missTokens,
      outputTokens: totals._sum.outputTokens ?? 0,
      cacheHitRatio: promptTokens === 0 ? null : hitTokens / promptTokens,
    },
    latency: {
      p50: latency[0]?.p50 ?? null,
      p95: latency[0]?.p95 ?? null,
    },
    failures: failures.map((row) => ({
      errorCode: row.errorCode ?? "unknown",
      calls: row._count._all,
    })),
    byModel: byModel
      .map((row) => ({
        model: row.model,
        calls: row._count._all,
        costUsd: Number(row._sum.costUsd ?? 0),
      }))
      .sort((a, b) => b.costUsd - a.costUsd),
    byPurpose: byPurpose
      .map((row) => ({
        purpose: row.purpose,
        calls: row._count._all,
        costUsd: Number(row._sum.costUsd ?? 0),
      }))
      .sort((a, b) => b.costUsd - a.costUsd),
  };
}

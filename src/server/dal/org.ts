import "server-only";
import { prisma } from "@/lib/db";
import type { Difficulty } from "@/lib/schemas";
import { integritySchema } from "@/lib/schemas";
import { clientQuestionSelect, toClientQuestion } from "@/server/dal/dto";
import type { SessionDetail } from "@/server/dal/interview";
import type { Viewer } from "@/server/dal/owner";

/**
 * Membership-checked reads for the organizations surface.
 *
 * Every function that touches an org, a screen, or a candidate resolves the
 * viewer's role in the owning org first, and returns null (never a 403) when
 * they are not a member — the same non-disclosure doctrine as /admin: a
 * stranger who guesses a slug or a screen id learns nothing about whether it
 * exists.
 *
 * Candidate name/email are PII and the frozen question set carries answer keys;
 * both are reachable only through these gates. Questions cross to the client
 * only via toClientQuestion().
 */

export type OrgRole = "owner" | "admin" | "member";

/** The viewer's role in an org, or null if they are not a member. */
async function orgRole(viewer: Viewer, orgId: string): Promise<OrgRole | null> {
  if (viewer.kind !== "user") return null;

  const membership = await prisma.orgMember.findUnique({
    where: { orgId_userId: { orgId, userId: viewer.userId } },
    select: { role: true },
  });

  return (membership?.role as OrgRole | undefined) ?? null;
}

export type OrgSummary = {
  id: string;
  name: string;
  slug: string;
  role: OrgRole;
  screenCount: number;
};

/** The orgs the viewer belongs to. Anonymous viewers belong to none. */
export async function getViewerOrgs(viewer: Viewer): Promise<OrgSummary[]> {
  if (viewer.kind !== "user") return [];

  const memberships = await prisma.orgMember.findMany({
    where: { userId: viewer.userId },
    orderBy: { createdAt: "asc" },
    select: {
      role: true,
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
          _count: { select: { screens: true } },
        },
      },
    },
  });

  return memberships.map((m) => ({
    id: m.organization.id,
    name: m.organization.name,
    slug: m.organization.slug,
    role: m.role as OrgRole,
    screenCount: m.organization._count.screens,
  }));
}

export type OrgDetail = {
  id: string;
  name: string;
  slug: string;
  role: OrgRole;
};

/**
 * An org by slug, but only for a member. Both "no such org" and "not a member"
 * return null, so this cannot be used to probe which slugs exist.
 */
export async function getOrgBySlug(
  viewer: Viewer,
  slug: string,
): Promise<OrgDetail | null> {
  if (viewer.kind !== "user") return null;

  const org = await prisma.organization.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      members: {
        where: { userId: viewer.userId },
        select: { role: true },
      },
    },
  });

  const membership = org?.members[0];
  if (!org || !membership) return null;

  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    role: membership.role as OrgRole,
  };
}

export type ScreenRow = {
  id: string;
  title: string;
  topic: string;
  difficulty: Difficulty;
  questionCount: number;
  active: boolean;
  candidateCount: number;
  /** Average over graded attempts only; null until one exists. */
  avgScore: number | null;
  createdAt: Date;
};

/**
 * The org's screens with per-screen candidate counts and average score.
 * Membership is re-checked here rather than trusted from the caller.
 */
export async function listScreens(
  viewer: Viewer,
  orgId: string,
): Promise<ScreenRow[]> {
  if (!(await orgRole(viewer, orgId))) return [];

  const screens = await prisma.screen.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      topic: true,
      difficulty: true,
      questionCount: true,
      active: true,
      createdAt: true,
    },
  });

  if (screens.length === 0) return [];

  const stats = await prisma.interviewSession.groupBy({
    by: ["screenId"],
    where: { screenId: { in: screens.map((s) => s.id) } },
    _count: { _all: true },
    // Prisma averages only non-null scores, so this is the graded-attempt mean.
    _avg: { score: true },
  });

  const byScreen = new Map(stats.map((s) => [s.screenId, s]));

  return screens.map((screen) => {
    const stat = byScreen.get(screen.id);
    return {
      ...screen,
      candidateCount: stat?._count._all ?? 0,
      avgScore:
        stat?._avg.score === null || stat?._avg.score === undefined
          ? null
          : Number(stat._avg.score),
    };
  });
}

export type CandidateRow = {
  id: string;
  name: string | null;
  email: string | null;
  status: SessionDetail["status"];
  score: number | null;
  /** submittedAt − startedAt, or null while unsubmitted. */
  durationMs: number | null;
  /** Client-reported focus/paste signals; null when none were recorded. */
  integrity: { blurs: number; pastes: number } | null;
};

export type ScreenReport = {
  screen: {
    id: string;
    title: string;
    topic: string;
    difficulty: Difficulty;
    questionCount: number;
    timeLimitMs: number | null;
    active: boolean;
    inviteToken: string;
    orgName: string;
    orgSlug: string;
  };
  /** owner/admin may toggle and rotate; a plain member reads only. */
  canManage: boolean;
  candidates: CandidateRow[];
};

/** A screen and every candidate attempt at it, for org members. */
export async function getScreenReport(
  viewer: Viewer,
  screenId: string,
): Promise<ScreenReport | null> {
  const screen = await prisma.screen.findUnique({
    where: { id: screenId },
    select: {
      id: true,
      title: true,
      topic: true,
      difficulty: true,
      questionCount: true,
      timeLimitMs: true,
      active: true,
      inviteToken: true,
      orgId: true,
      organization: { select: { name: true, slug: true } },
    },
  });

  if (!screen) return null;

  const role = await orgRole(viewer, screen.orgId);
  if (!role) return null;

  const sessions = await prisma.interviewSession.findMany({
    where: { screenId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      candidateName: true,
      candidateEmail: true,
      status: true,
      score: true,
      startedAt: true,
      submittedAt: true,
      integrity: true,
    },
  });

  return {
    screen: {
      id: screen.id,
      title: screen.title,
      topic: screen.topic,
      difficulty: screen.difficulty,
      questionCount: screen.questionCount,
      timeLimitMs: screen.timeLimitMs,
      active: screen.active,
      inviteToken: screen.inviteToken,
      orgName: screen.organization.name,
      orgSlug: screen.organization.slug,
    },
    canManage: role === "owner" || role === "admin",
    candidates: sessions.map((s) => ({
      id: s.id,
      name: s.candidateName,
      email: s.candidateEmail,
      status: s.status,
      score: s.score === null ? null : Number(s.score),
      durationMs:
        s.submittedAt && s.startedAt
          ? s.submittedAt.getTime() - s.startedAt.getTime()
          : null,
      integrity: parseIntegrity(s.integrity),
    })),
  };
}

export type CandidateDetail = {
  detail: SessionDetail;
  candidate: {
    name: string | null;
    email: string | null;
    status: SessionDetail["status"];
    score: number | null;
    durationMs: number | null;
    integrity: { blurs: number; pastes: number } | null;
  };
  screen: { id: string; title: string; orgName: string; orgSlug: string };
};

/**
 * One candidate attempt, assembled into the SessionDetail shape ResultView
 * renders. Answers are revealed only once the attempt is graded — an org
 * member reading an in-progress attempt still must not see the key.
 */
export async function getCandidateDetail(
  viewer: Viewer,
  sessionId: string,
): Promise<CandidateDetail | null> {
  const session = await prisma.interviewSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      topic: true,
      difficulty: true,
      status: true,
      questionCount: true,
      score: true,
      expiresAt: true,
      timeLimitMs: true,
      createdAt: true,
      shareId: true,
      error: true,
      mode: true,
      adaptive: true,
      rematchOfId: true,
      candidateName: true,
      candidateEmail: true,
      startedAt: true,
      submittedAt: true,
      integrity: true,
      screen: {
        select: {
          id: true,
          title: true,
          orgId: true,
          organization: { select: { name: true, slug: true } },
        },
      },
      questions: { orderBy: { index: "asc" }, select: clientQuestionSelect },
    },
  });

  if (!session || !session.screen) return null;

  const role = await orgRole(viewer, session.screen.orgId);
  if (!role) return null;

  const revealAnswers = session.status === "GRADED";
  const score = session.score === null ? null : Number(session.score);

  const detail: SessionDetail = {
    id: session.id,
    topic: session.topic,
    difficulty: session.difficulty,
    status: session.status,
    questionCount: session.questionCount,
    score,
    expiresAt: session.expiresAt,
    timeLimitMs: session.timeLimitMs,
    createdAt: session.createdAt,
    shareId: session.shareId,
    error: session.error,
    mode: session.mode,
    adaptive: session.adaptive,
    rematchOfId: session.rematchOfId,
    questions: session.questions.map((q) => toClientQuestion(q, revealAnswers)),
  };

  return {
    detail,
    candidate: {
      name: session.candidateName,
      email: session.candidateEmail,
      status: session.status,
      score,
      durationMs:
        session.submittedAt && session.startedAt
          ? session.submittedAt.getTime() - session.startedAt.getTime()
          : null,
      integrity: parseIntegrity(session.integrity),
    },
    screen: {
      id: session.screen.id,
      title: session.screen.title,
      orgName: session.screen.organization.name,
      orgSlug: session.screen.organization.slug,
    },
  };
}

export type PublicScreen = {
  orgName: string;
  title: string;
  topic: string;
  difficulty: Difficulty;
  questionCount: number;
  timeLimitMs: number | null;
};

/**
 * The candidate-facing view of an invite. Public, and active screens only —
 * the questions JSON is never selected here, so no answer key can leak to an
 * unauthenticated visitor. Unknown or deactivated token returns null.
 */
export async function getScreenByInviteToken(
  token: string,
): Promise<PublicScreen | null> {
  const screen = await prisma.screen.findFirst({
    where: { inviteToken: token, active: true },
    select: {
      title: true,
      topic: true,
      difficulty: true,
      questionCount: true,
      timeLimitMs: true,
      organization: { select: { name: true } },
    },
  });

  if (!screen) return null;

  return {
    orgName: screen.organization.name,
    title: screen.title,
    topic: screen.topic,
    difficulty: screen.difficulty,
    questionCount: screen.questionCount,
    timeLimitMs: screen.timeLimitMs,
  };
}

/** True when the viewer is a member of the org that owns the screen session. */
export async function isScreenSessionViewableBy(
  viewer: Viewer,
  sessionId: string,
): Promise<boolean> {
  if (viewer.kind !== "user") return false;

  const session = await prisma.interviewSession.findUnique({
    where: { id: sessionId },
    select: { screen: { select: { orgId: true } } },
  });

  if (!session?.screen) return false;
  return (await orgRole(viewer, session.screen.orgId)) !== null;
}

/**
 * The result-page gate for a SCREEN session: whether the viewer may see the
 * graded result, and the org name to show them if not. Bundled so the result
 * page needs one call rather than two.
 */
export async function getScreenGate(
  viewer: Viewer,
  sessionId: string,
): Promise<{ orgName: string; viewable: boolean }> {
  const session = await prisma.interviewSession.findUnique({
    where: { id: sessionId },
    select: {
      screen: {
        select: { orgId: true, organization: { select: { name: true } } },
      },
    },
  });

  if (!session?.screen) return { orgName: "the organization", viewable: false };

  const viewable =
    viewer.kind === "user" &&
    (await orgRole(viewer, session.screen.orgId)) !== null;

  return { orgName: session.screen.organization.name, viewable };
}

/** Integrity is a client-reported JSON blob; validate before trusting it. */
function parseIntegrity(
  raw: unknown,
): { blurs: number; pastes: number } | null {
  if (raw == null) return null;
  const parsed = integritySchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

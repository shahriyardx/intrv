import "server-only";
import { prisma } from "@/lib/db";
import type { Difficulty } from "@/lib/schemas";
import { integritySchema } from "@/lib/schemas";
import { clientQuestionSelect, toClientQuestion } from "@/server/dal/dto";
import type { SessionDetail } from "@/server/dal/interview";
import type { Viewer } from "@/server/dal/owner";
import { getAuthSession } from "@/server/dal/session";

/**
 * Membership-checked reads for the organizations surface.
 *
 * Every function that touches an org, an assessment, or a candidate resolves the
 * viewer's role in the owning org first, and returns null (never a 403) when
 * they are not a member — the same non-disclosure doctrine as /admin: a
 * stranger who guesses a slug or an assessment id learns nothing about whether it
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

  const membership = await prisma.member.findUnique({
    where: {
      organizationId_userId: { organizationId: orgId, userId: viewer.userId },
    },
    select: { role: true },
  });

  return (membership?.role as OrgRole | undefined) ?? null;
}

export type ActiveOrg = {
  id: string;
  name: string;
  slug: string;
  role: OrgRole;
};

/**
 * The viewer's organization — the source of truth for "this is an org account".
 *
 * One org per user, so the account model is binary: an org account has exactly
 * one membership, a personal account has none. We read the org from
 * `session.activeOrganizationId` (the better-auth plugin sets it when the org is
 * created), then verify the membership and pull the role. The cookie cache can
 * briefly lag a just-created org, so we fall back to the user's single
 * membership — same answer, one org per user — rather than flash "personal".
 *
 * Returns null for anonymous and personal accounts alike.
 */
export async function getActiveOrg(): Promise<ActiveOrg | null> {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) return null;

  const activeOrgId = session.session.activeOrganizationId ?? null;

  const membership = activeOrgId
    ? await prisma.member.findUnique({
        where: {
          organizationId_userId: { organizationId: activeOrgId, userId },
        },
        select: {
          role: true,
          organization: { select: { id: true, name: true, slug: true } },
        },
      })
    : // Fallback while the session catches up: one org per user, so the single
      // membership is unambiguous.
      await prisma.member.findFirst({
        where: { userId },
        select: {
          role: true,
          organization: { select: { id: true, name: true, slug: true } },
        },
      });

  if (!membership) return null;

  return {
    id: membership.organization.id,
    name: membership.organization.name,
    slug: membership.organization.slug,
    role: membership.role as OrgRole,
  };
}

/**
 * Whether the viewer is an organization account. The one gate the app splits on:
 * org accounts see only the org surface, personal accounts never see it.
 */
export async function isOrgAccount(): Promise<boolean> {
  return (await getActiveOrg()) !== null;
}

export type AssessmentRow = {
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
 * The org's assessments with per-assessment candidate counts and average score.
 * Membership is re-checked here rather than trusted from the caller.
 */
export async function listAssessments(
  viewer: Viewer,
  orgId: string,
): Promise<AssessmentRow[]> {
  if (!(await orgRole(viewer, orgId))) return [];

  const assessments = await prisma.assessment.findMany({
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

  if (assessments.length === 0) return [];

  const stats = await prisma.interviewSession.groupBy({
    by: ["assessmentId"],
    where: { assessmentId: { in: assessments.map((s) => s.id) } },
    _count: { _all: true },
    // Prisma averages only non-null scores, so this is the graded-attempt mean.
    _avg: { score: true },
  });

  const byScreen = new Map(stats.map((s) => [s.assessmentId, s]));

  return assessments.map((assessment) => {
    const stat = byScreen.get(assessment.id);
    return {
      ...assessment,
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

export type AssessmentReport = {
  assessment: {
    id: string;
    title: string;
    topic: string;
    difficulty: Difficulty;
    questionCount: number;
    timeLimitMs: number | null;
    active: boolean;
    inviteToken: string;
  };
  /** owner/admin may toggle and rotate; a plain member reads only. */
  canManage: boolean;
  candidates: CandidateRow[];
};

/** An assessment and every candidate attempt at it, for org members. */
export async function getAssessmentReport(
  viewer: Viewer,
  assessmentId: string,
): Promise<AssessmentReport | null> {
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
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
    },
  });

  if (!assessment) return null;

  const role = await orgRole(viewer, assessment.orgId);
  if (!role) return null;

  const sessions = await prisma.interviewSession.findMany({
    where: { assessmentId },
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
    assessment: {
      id: assessment.id,
      title: assessment.title,
      topic: assessment.topic,
      difficulty: assessment.difficulty,
      questionCount: assessment.questionCount,
      timeLimitMs: assessment.timeLimitMs,
      active: assessment.active,
      inviteToken: assessment.inviteToken,
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
  assessment: { id: string; title: string; orgName: string; orgSlug: string };
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
      rematchOfId: true,
      candidateName: true,
      candidateEmail: true,
      startedAt: true,
      submittedAt: true,
      integrity: true,
      assessment: {
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

  if (!session || !session.assessment) return null;

  const role = await orgRole(viewer, session.assessment.orgId);
  if (!role) return null;

  const revealAnswers = session.status === "GRADED";
  const score = session.score === null ? null : Number(session.score);

  const detail: SessionDetail = {
    // A recruiter reading a candidate's attempt is never its owner, and an
    // ASSESSMENT earns no XP anyway.
    owned: false,
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
    assessment: {
      id: session.assessment.id,
      title: session.assessment.title,
      orgName: session.assessment.organization.name,
      orgSlug: session.assessment.organization.slug,
    },
  };
}

export type PublicAssessment = {
  orgName: string;
  title: string;
  topic: string;
  difficulty: Difficulty;
  questionCount: number;
  timeLimitMs: number | null;
};

/**
 * The candidate-facing view of an invite. Public, and active assessments only —
 * the questions JSON is never selected here, so no answer key can leak to an
 * unauthenticated visitor. Unknown or deactivated token returns null.
 */
export async function getAssessmentByInviteToken(
  token: string,
): Promise<PublicAssessment | null> {
  const assessment = await prisma.assessment.findFirst({
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

  if (!assessment) return null;

  return {
    orgName: assessment.organization.name,
    title: assessment.title,
    topic: assessment.topic,
    difficulty: assessment.difficulty,
    questionCount: assessment.questionCount,
    timeLimitMs: assessment.timeLimitMs,
  };
}

/** True when the viewer is a member of the org that owns the assessment session. */
export async function isAssessmentSessionViewableBy(
  viewer: Viewer,
  sessionId: string,
): Promise<boolean> {
  if (viewer.kind !== "user") return false;

  const session = await prisma.interviewSession.findUnique({
    where: { id: sessionId },
    select: { assessment: { select: { orgId: true } } },
  });

  if (!session?.assessment) return false;
  return (await orgRole(viewer, session.assessment.orgId)) !== null;
}

/**
 * The result-page gate for an ASSESSMENT session: whether the viewer may see the
 * graded result, and the org name to show them if not. Bundled so the result
 * page needs one call rather than two.
 */
export async function getAssessmentGate(
  viewer: Viewer,
  sessionId: string,
): Promise<{ orgName: string; viewable: boolean }> {
  const session = await prisma.interviewSession.findUnique({
    where: { id: sessionId },
    select: {
      assessment: {
        select: { orgId: true, organization: { select: { name: true } } },
      },
    },
  });

  if (!session?.assessment)
    return { orgName: "the organization", viewable: false };

  const viewable =
    viewer.kind === "user" &&
    (await orgRole(viewer, session.assessment.orgId)) !== null;

  return { orgName: session.assessment.organization.name, viewable };
}

/** Integrity is a client-reported JSON blob; validate before trusting it. */
export function parseIntegrity(
  raw: unknown,
): { blurs: number; pastes: number } | null {
  if (raw == null) return null;
  const parsed = integritySchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

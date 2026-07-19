import {
  FlameIcon,
  LockSimpleIcon,
  SealCheckIcon,
} from "@phosphor-icons/react/dist/ssr";
import { format, formatDistanceToNow } from "date-fns";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActivityHeatmap } from "@/components/analytics/activity-heatmap";
import { formatScore } from "@/components/analytics/format";
import {
  ScoreTrendChart,
  type TrendDatum,
} from "@/components/analytics/score-trend-chart";
import { StatRow, StatTile } from "@/components/analytics/stat-tile";
import { BadgeShelf, type ShelfBadge } from "@/components/game/badge-shelf";
import { LevelBar } from "@/components/game/level-bar";
import { SiteHeader } from "@/components/site-header";
import { SiteNav } from "@/components/site-nav";
import { Badge } from "@/components/ui/badge";
import { shell } from "@/components/ui/page";
import { DataLabel } from "@/components/ui/prose";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  getPublicProfile,
  type ProfileConcept,
  type ProfileDifficulty,
  type ProfileRun,
  type PublicProfile,
} from "@/server/dal/profile";

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const profile = await getPublicProfile(username);
  if (!profile) return { title: "Profile" };
  return {
    title: `${profile.displayName} (@${profile.username})`,
    description:
      profile.visibility === "public"
        ? `Level ${profile.level.level} · ${profile.xp.toLocaleString()} XP · ${profile.gradedCount} graded interviews on Intrv.`
        : "This profile is private.",
  };
}

/**
 * A public profile. Synchronous shell so the header prerenders; the lookup is
 * request-time (params is dynamic under cacheComponents), so it lives in the
 * Suspense hole.
 */
export default function ProfilePage({ params }: Props) {
  return (
    <>
      <SiteHeader>
        <SiteNav />
      </SiteHeader>
      <main className={cn(shell, "flex-1 py-14")}>
        <Suspense fallback={<ProfileSkeleton />}>
          <Profile params={params} />
        </Suspense>
      </main>
    </>
  );
}

async function Profile({ params }: Props) {
  const { username } = await params;
  const profile = await getPublicProfile(username);

  // Missing or banned: nothing here, and nothing about which.
  if (!profile) notFound();

  return (
    <div className="space-y-14">
      <ProfileHeader
        profile={profile}
        badges={
          profile.visibility === "public"
            ? profile.badges.filter((badge) => badge.earned)
            : undefined
        }
      />
      {profile.visibility === "private" ? (
        <PrivateNotice />
      ) : (
        <PublicBody profile={profile} />
      )}
    </div>
  );
}

function ProfileHeader({
  profile,
  badges,
}: {
  profile: {
    displayName: string;
    username: string;
    image?: string | null;
    joinedAt?: Date;
    level?: { level: number; title: string };
  };
  /** Earned badges only, or undefined for a private profile. */
  badges?: ShelfBadge[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      {profile.image ? (
        // biome-ignore lint/performance/noImgElement: remote avatar from an arbitrary OAuth provider
        <img
          src={profile.image}
          alt=""
          aria-hidden
          width={56}
          height={56}
          referrerPolicy="no-referrer"
          className="size-14 rounded-full border object-cover"
        />
      ) : (
        <span
          aria-hidden
          className="flex size-14 items-center justify-center border bg-secondary font-mono text-secondary-foreground text-sm uppercase"
        >
          {initials(profile.displayName)}
        </span>
      )}
      <div className="min-w-0">
        <h1 className="font-display text-display-md">{profile.displayName}</h1>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-muted-foreground text-sm">
          <span>@{profile.username}</span>
          {profile.level ? (
            <>
              <span aria-hidden>·</span>
              <span className="text-[0.625rem] uppercase tracking-[0.12em]">
                Level {profile.level.level} {profile.level.title}
              </span>
            </>
          ) : null}
          {profile.joinedAt ? (
            <>
              <span aria-hidden>·</span>
              <span className="text-xs">
                Joined {format(profile.joinedAt, "MMMM yyyy")}
              </span>
            </>
          ) : null}
        </p>

        {/* Earned only, and no count: a visitor has no use for how many this
            person has *not* got. Tap one for what it is. */}
        {badges ? <BadgeShelf badges={badges} className="mt-2.5" /> : null}
      </div>
    </div>
  );
}

function PrivateNotice() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-dashed py-16 text-center">
      <LockSimpleIcon
        aria-hidden
        weight="duotone"
        className="size-7 text-muted-foreground"
      />
      <p className="font-display text-display-md">This profile is private</p>
      <p className="max-w-sm text-muted-foreground text-sm">
        This person has chosen to keep their practice off public pages. Their
        handle is real; their stats are not shown.
      </p>
    </div>
  );
}

function PublicBody({ profile }: { profile: PublicProfile }) {
  // Preformatted here: the chart is a client component and the axis needs a
  // short string, not a Date crossing the boundary.
  const trendData: TrendDatum[] = profile.trend.map((point) => ({
    sessionId: point.sessionId,
    topic: point.topic,
    difficulty: point.difficulty,
    score: point.score,
    label: format(point.gradedAt, "d MMM"),
    fullDate: format(point.gradedAt, "d MMM yyyy"),
  }));

  return (
    <div className="space-y-14">
      <StatRow>
        <StatTile
          label="Rank"
          value={
            profile.rank === null ? "—" : `#${profile.rank.toLocaleString()}`
          }
          note={
            profile.rank === null ? "Not ranked yet" : "All-time leaderboard"
          }
        />
        <StatTile
          label="Level"
          value={profile.level.level}
          note={`${profile.level.title} · ${profile.xp.toLocaleString()} XP`}
        />
        <StatTile
          label="Streak"
          value={
            <span className="inline-flex items-center gap-1.5">
              <FlameIcon
                aria-hidden
                weight="fill"
                className="size-5 text-muted-foreground"
              />
              {profile.currentStreak}
            </span>
          }
          note={`Best ${profile.longestStreak}`}
        />
        <StatTile
          label="Average"
          value={
            profile.averageScore === null
              ? "—"
              : `${formatScore(profile.averageScore)}%`
          }
          note={`${profile.gradedCount} graded${
            profile.perfectCount > 0 ? ` · ${profile.perfectCount} perfect` : ""
          }`}
        />
      </StatRow>

      <LevelBar level={profile.level} />

      {profile.gradedCount === 0 ? (
        <p className="text-muted-foreground text-sm">
          No graded interviews yet.
        </p>
      ) : (
        <>
          {/* One point is a dot, not a trend — show the number instead. */}
          {trendData.length > 1 ? (
            <section className="space-y-5">
              <div className="flex items-baseline justify-between gap-4">
                <DataLabel as="h2">Score over time</DataLabel>
                <span className="font-mono text-muted-foreground text-xs">
                  last {trendData.length} graded
                </span>
              </div>
              <ScoreTrendChart data={trendData} />
            </section>
          ) : null}

          <section className="space-y-5">
            <div className="flex items-baseline justify-between gap-4">
              <DataLabel as="h2">Activity</DataLabel>
              <span className="font-mono text-muted-foreground text-xs">
                {profile.calendar.total} in the last year
              </span>
            </div>
            <ActivityHeatmap calendar={profile.calendar} />
          </section>

          <DifficultySpread spread={profile.difficultySpread} />

          <div className="grid gap-12 lg:grid-cols-2">
            <RunList
              title="Best runs"
              runs={profile.bestRuns}
              showDate={false}
            />
            <RunList title="Recent" runs={profile.recentRuns} showDate />
          </div>

          <div className="grid gap-12 lg:grid-cols-2">
            <TopTopics topics={profile.topTopics} />
            <StrongConcepts concepts={profile.strongConcepts} />
          </div>
        </>
      )}
    </div>
  );
}

function DifficultySpread({ spread }: { spread: ProfileDifficulty[] }) {
  if (spread.length === 0) return null;

  return (
    <section className="space-y-5">
      <DataLabel as="h2">Where they practise</DataLabel>
      <ul className="space-y-2.5">
        {spread.map((row) => (
          <li key={row.difficulty} className="flex items-center gap-4 text-sm">
            <span className="w-20 shrink-0 font-mono text-[0.625rem] text-muted-foreground uppercase tracking-[0.12em]">
              {row.difficulty.toLowerCase()}
            </span>
            <span
              aria-hidden
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary"
            >
              <span
                className="block h-full rounded-full bg-primary"
                style={{ width: `${row.share}%` }}
              />
            </span>
            <span className="w-20 shrink-0 text-right font-mono text-muted-foreground text-xs tabular">
              {row.count} {row.count === 1 ? "run" : "runs"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function RunList({
  title,
  runs,
  showDate,
}: {
  title: string;
  runs: ProfileRun[];
  showDate: boolean;
}) {
  return (
    <section className="space-y-5">
      <DataLabel as="h2">{title}</DataLabel>
      <ul className="divide-y border-t">
        {runs.map((run) => (
          <li key={run.id} className="flex items-center gap-4 py-3 text-sm">
            <span className="min-w-0 flex-1">
              <span className="block truncate">{run.topic}</span>
              {showDate ? (
                <span className="mt-0.5 block font-mono text-[0.625rem] text-muted-foreground uppercase tracking-[0.12em]">
                  {formatDistanceToNow(run.gradedAt, { addSuffix: true })}
                </span>
              ) : null}
            </span>
            <Badge variant="outline" className="text-[0.625rem]">
              {run.difficulty.toLowerCase()}
            </Badge>
            <span className="w-12 shrink-0 text-right font-mono tabular">
              {formatScore(run.score)}%
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TopTopics({
  topics,
}: {
  topics: { topic: string; averageScore: number; attempts: number }[];
}) {
  if (topics.length === 0) {
    return (
      <section className="space-y-5">
        <DataLabel as="h2">Top topics</DataLabel>
        <p className="text-muted-foreground text-sm">
          Not enough attempts on any one topic yet.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <DataLabel as="h2">Top topics</DataLabel>
      <ul className="divide-y border-t">
        {topics.map((t) => (
          <li key={t.topic} className="flex items-center gap-4 py-3 text-sm">
            <span className="min-w-0 flex-1 truncate">{t.topic}</span>
            <span className="shrink-0 font-mono text-[0.625rem] text-muted-foreground uppercase tracking-[0.12em]">
              {t.attempts} {t.attempts === 1 ? "run" : "runs"}
            </span>
            <span className="w-12 shrink-0 text-right font-mono tabular">
              {formatScore(t.averageScore)}%
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Strengths only. The dashboard's mastery map is weakest-first because it is a
 * study tool for its owner; a public page does not publish what someone keeps
 * getting wrong.
 */
function StrongConcepts({ concepts }: { concepts: ProfileConcept[] }) {
  return (
    <section className="space-y-5">
      <DataLabel as="h2">Strongest concepts</DataLabel>
      {concepts.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Not enough answered questions on any one concept yet.
        </p>
      ) : (
        <ul className="divide-y border-t">
          {concepts.map((c) => (
            <li
              key={c.concept}
              className="flex items-center gap-3 py-3 text-sm"
            >
              <SealCheckIcon
                aria-hidden
                weight="fill"
                className="size-3.5 shrink-0 text-muted-foreground"
              />
              <span className="min-w-0 flex-1 truncate">{c.concept}</span>
              <span className="shrink-0 font-mono text-[0.625rem] text-muted-foreground uppercase tracking-[0.12em]">
                {c.attempts} seen
              </span>
              <span className="w-12 shrink-0 text-right font-mono tabular">
                {Math.round(c.correctRate)}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function initials(name: string): string {
  return (
    name
      .split(/[\s.@_-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase() || "?"
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-12">
      <div className="flex items-center gap-4">
        <Skeleton className="size-14 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-28" />
        </div>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {["a", "b", "c", "d"].map((k) => (
          <Skeleton key={k} className="h-20" />
        ))}
      </div>
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

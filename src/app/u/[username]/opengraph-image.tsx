import { ImageResponse } from "next/og";
import { connection } from "next/server";
import {
  ACCENT,
  DISPLAY,
  Eyebrow,
  INK,
  loadOgFonts,
  MONO,
  MUTED,
  OG_SIZE,
  PAPER,
  RULE,
  Stat,
  truncate,
  Wordmark,
} from "@/lib/og";
import { getPublicProfile } from "@/server/dal/profile";

export const alt = "An Intrv profile";
export const size = OG_SIZE;
export const contentType = "image/png";

function Card({
  eyebrow,
  headline,
  byline,
  level,
  stats,
}: {
  eyebrow: string;
  headline: string;
  byline?: string | null;
  level: string | null;
  stats: { label: string; value: string }[];
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        backgroundColor: PAPER,
        color: INK,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Wordmark />
        <Eyebrow>{eyebrow}</Eyebrow>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        {level ? (
          // The acid bar sits under the level like a highlighter stroke — the
          // one place on the card the accent is allowed to appear.
          <div
            style={{
              display: "flex",
              position: "relative",
              alignSelf: "flex-start",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 14,
                height: 24,
                backgroundColor: ACCENT,
              }}
            />
            <span
              style={{
                fontFamily: DISPLAY,
                fontSize: 128,
                letterSpacing: -5,
                lineHeight: 1,
                color: INK,
              }}
            >
              {level}
            </span>
          </div>
        ) : null}
        <span
          style={{
            fontFamily: DISPLAY,
            fontSize: 62,
            letterSpacing: -1.5,
            lineHeight: 1.05,
            marginTop: level ? 28 : 0,
            color: INK,
          }}
        >
          {headline}
        </span>
        {byline ? (
          <span
            style={{
              fontFamily: MONO,
              fontSize: 22,
              marginTop: 14,
              color: MUTED,
            }}
          >
            {byline}
          </span>
        ) : null}
      </div>

      <div
        style={{
          display: "flex",
          gap: 72,
          paddingTop: 28,
          borderTop: `1px solid ${RULE}`,
        }}
      >
        {stats.map((stat) => (
          <Stat key={stat.label} label={stat.label} value={stat.value} />
        ))}
      </div>
    </div>
  );
}

export default async function Image({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  // Per-visitor by nature; connection() marks this request-time so
  // cacheComponents doesn't try to prerender it.
  await connection();

  // Crawlers hit this with junk handles. Every outcome must still be a branded
  // image, never a throw.
  const profile = await getPublicProfile(username).catch(() => null);

  // A private profile gets a card too, and it says nothing but the handle —
  // the page itself discloses exactly that much, and no more.
  const card =
    profile === null ? (
      <Card
        eyebrow="AI interview practice"
        headline="No such profile."
        level={null}
        stats={[{ label: "Practice anything", value: "no account needed" }]}
      />
    ) : profile.visibility === "private" ? (
      <Card
        eyebrow="Private profile · Intrv"
        headline={truncate(profile.displayName, 42)}
        byline={`@${truncate(profile.username, 32)}`}
        level={null}
        stats={[{ label: "Stats", value: "not shared" }]}
      />
    ) : (
      <Card
        eyebrow="Profile · Intrv"
        headline={truncate(profile.displayName, 42)}
        byline={`@${truncate(profile.username, 32)} · ${profile.level.title}`}
        level={`Lv ${profile.level.level}`}
        stats={[
          { label: "XP", value: profile.xp.toLocaleString() },
          { label: "Graded", value: String(profile.gradedCount) },
          {
            label: "Streak",
            value: `${profile.currentStreak} ${
              profile.currentStreak === 1 ? "day" : "days"
            }`,
          },
          {
            label: "Rank",
            value: profile.rank === null ? "—" : `#${profile.rank}`,
          },
        ]}
      />
    );

  const fonts = await loadOgFonts();

  return new ImageResponse(card, {
    ...size,
    fonts: fonts.length > 0 ? fonts : undefined,
  });
}

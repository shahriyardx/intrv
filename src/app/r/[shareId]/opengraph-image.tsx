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
import { getSharedSession } from "@/server/dal/share";

export const alt = "An Intrv result";
export const size = OG_SIZE;
export const contentType = "image/png";

function formatScore(score: number | null): string {
  if (score === null) return "—";
  return Number.isInteger(score) ? `${score}%` : `${score.toFixed(1)}%`;
}

function Card({
  eyebrow,
  headline,
  byline,
  score,
  stats,
}: {
  eyebrow: string;
  headline: string;
  byline?: string | null;
  score: string | null;
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
        {score ? (
          // The acid bar sits under the numerals like a highlighter stroke —
          // the one place on the card the accent is allowed to appear.
          <div
            style={{
              display: "flex",
              position: "relative",
              // Shrink-to-fit, so the stroke is only as wide as the numerals.
              alignSelf: "flex-start",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 18,
                height: 30,
                backgroundColor: ACCENT,
              }}
            />
            <span
              style={{
                fontFamily: DISPLAY,
                fontSize: 190,
                letterSpacing: -8,
                lineHeight: 1,
                color: INK,
              }}
            >
              {score}
            </span>
          </div>
        ) : null}
        <span
          style={{
            fontFamily: DISPLAY,
            fontSize: 62,
            letterSpacing: -1.5,
            lineHeight: 1.05,
            marginTop: score ? 28 : 0,
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
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = await params;

  // The read is uncached and per-visitor by nature; connection() marks this
  // request-time so cacheComponents doesn't try to prerender it.
  await connection();

  // Crawlers hit this endpoint with junk ids and dead links. Both must still
  // come back as a branded image, never a throw.
  const session = await getSharedSession(shareId).catch(() => null);
  const fonts = await loadOgFonts();

  const card = session ? (
    <Card
      eyebrow="Verified result · Intrv"
      headline={truncate(session.topic, 52)}
      byline={
        session.takerName ? `by ${truncate(session.takerName, 32)}` : null
      }
      score={formatScore(session.score)}
      stats={[
        { label: "Difficulty", value: session.difficulty.toLowerCase() },
        { label: "Questions", value: String(session.questionCount) },
      ]}
    />
  ) : (
    <Card
      eyebrow="AI interview practice"
      headline="This result isn't here anymore."
      score={null}
      stats={[{ label: "Practice anything", value: "free to start" }]}
    />
  );

  return new ImageResponse(card, {
    ...size,
    fonts: fonts.length > 0 ? fonts : undefined,
  });
}

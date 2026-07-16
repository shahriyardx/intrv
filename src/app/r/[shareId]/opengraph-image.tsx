import { cacheLife } from "next/cache";
import { ImageResponse } from "next/og";
import { connection } from "next/server";
import { getSharedSession } from "@/server/dal/share";

export const alt = "An InterviewAI result";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Satori resolves neither our CSS variables nor oklch(), so the palette is
 * pinned here as the sRGB values those tokens compute to on paper. If
 * globals.css moves, these move with it.
 */
const PAPER = "#fbfaf7";
const INK = "#0f0d09";
const MUTED = "#605d59";
const ACCENT = "#d4ee40";
const RULE = "#dfdeda";

const DISPLAY = "Newsreader";
const MONO = "JetBrains Mono";

type Font = {
  name: string;
  data: ArrayBuffer;
  weight: 500 | 600;
  style: "normal";
};

/**
 * next/font never exposes the binary, so the OG renderer has to source its own
 * copy. Cached rather than fetched per crawl, and tolerant of failure: a card
 * in the fallback face beats a 500 to a crawler.
 */
async function loadFont(family: string, weight: 500 | 600) {
  "use cache";
  cacheLife("max");

  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}`,
      // The API serves woff2 to browsers; Satori only reads ttf/otf, which is
      // what an unrecognised agent gets.
      { headers: { "user-agent": "InterviewAI-og" } },
    ).then((res) => res.text());

    const url = css.match(/src: url\((.+?)\) format\('truetype'\)/)?.[1];
    if (!url) return null;

    const data = await fetch(url).then((res) => res.arrayBuffer());
    return Buffer.from(data).toString("base64");
  } catch {
    return null;
  }
}

async function loadFonts(): Promise<Font[]> {
  const faces = [
    { name: DISPLAY, weight: 600 },
    { name: MONO, weight: 500 },
  ] as const;

  const loaded = await Promise.all(
    faces.map(async (face) => {
      const base64 = await loadFont(face.name, face.weight);
      if (!base64) return null;
      const bytes = Buffer.from(base64, "base64");
      return {
        name: face.name,
        data: bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ) as ArrayBuffer,
        weight: face.weight,
        style: "normal",
      } satisfies Font;
    }),
  );

  return loaded.filter((face) => face !== null);
}

function formatScore(score: number | null): string {
  if (score === null) return "—";
  return Number.isInteger(score) ? `${score}%` : `${score.toFixed(1)}%`;
}

/** Satori has no line clamp we can trust, so the measure is enforced up front. */
function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

function Wordmark() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontFamily: DISPLAY, fontSize: 30, color: INK }}>
        InterviewAI
      </span>
      <span
        style={{
          width: 9,
          height: 9,
          borderRadius: 9,
          backgroundColor: ACCENT,
        }}
      />
    </div>
  );
}

function Eyebrow({ children }: { children: string }) {
  return (
    <span
      style={{
        fontFamily: MONO,
        fontSize: 16,
        letterSpacing: 2,
        textTransform: "uppercase",
        color: MUTED,
      }}
    >
      {children}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <Eyebrow>{label}</Eyebrow>
      <span style={{ fontFamily: MONO, fontSize: 26, color: INK }}>
        {value}
      </span>
    </div>
  );
}

function Card({
  eyebrow,
  headline,
  score,
  stats,
}: {
  eyebrow: string;
  headline: string;
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
  const fonts = await loadFonts();

  const card = session ? (
    <Card
      eyebrow="Shared result"
      headline={truncate(session.topic, 52)}
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
      stats={[{ label: "Practice anything", value: "no account needed" }]}
    />
  );

  return new ImageResponse(card, {
    ...size,
    fonts: fonts.length > 0 ? fonts : undefined,
  });
}

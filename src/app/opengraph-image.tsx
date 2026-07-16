import { cacheLife } from "next/cache";
import { ImageResponse } from "next/og";

export const alt =
  "InterviewAI — practice interviews that tell you what to fix";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The sRGB values our oklch tokens compute to on paper. Satori reads neither. */
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

export default async function Image() {
  const fonts = await loadFonts();

  return new ImageResponse(
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
        <Eyebrow>AI interview practice</Eyebrow>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <span
          style={{
            fontFamily: DISPLAY,
            fontSize: 86,
            letterSpacing: -3,
            lineHeight: 1.02,
            color: INK,
          }}
        >
          Practice interviews
        </span>
        {/* The landing page's one accent move: an acid stroke under the
              phrase that carries the promise. */}
        <div
          style={{
            display: "flex",
            position: "relative",
            // Shrink-to-fit, so the stroke ends where the phrase does.
            alignSelf: "flex-start",
            marginTop: 6,
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 12,
              height: 22,
              backgroundColor: ACCENT,
            }}
          />
          <span
            style={{
              fontFamily: DISPLAY,
              fontSize: 86,
              letterSpacing: -3,
              lineHeight: 1.02,
              color: INK,
            }}
          >
            that tell you what to fix
          </span>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: 28,
          borderTop: `1px solid ${RULE}`,
        }}
      >
        <span style={{ fontSize: 26, color: MUTED }}>
          Any topic. Graded feedback, not just a number.
        </span>
        <Eyebrow>No account needed</Eyebrow>
      </div>
    </div>,
    { ...size, fonts: fonts.length > 0 ? fonts : undefined },
  );
}

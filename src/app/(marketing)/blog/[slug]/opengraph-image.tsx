import { cacheLife } from "next/cache";
import { ImageResponse } from "next/og";
import { connection } from "next/server";
import { getPublishedPost } from "@/server/dal/blog";

export const alt = "An Intrv post";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Satori resolves neither our CSS variables nor oklch(), so the palette is
 * pinned here as the sRGB values those tokens compute to on paper — the same
 * set r/[shareId]/opengraph-image.tsx pins. If globals.css moves, these move
 * with it.
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
      { headers: { "user-agent": "Intrv-og" } },
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

/** Satori has no line clamp we can trust, so the measure is enforced up front. */
function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

function Wordmark() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontFamily: DISPLAY, fontSize: 30, color: INK }}>
        Intrv
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

function Card({
  headline,
  excerpt,
  meta,
}: {
  headline: string;
  excerpt: string | null;
  meta: string;
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
        <Eyebrow>Blog</Eyebrow>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <span
          style={{
            fontFamily: DISPLAY,
            fontSize: 70,
            letterSpacing: -2,
            lineHeight: 1.05,
            color: INK,
          }}
        >
          {headline}
        </span>
        {excerpt ? (
          <span
            style={{
              fontFamily: DISPLAY,
              fontSize: 28,
              lineHeight: 1.4,
              marginTop: 24,
              color: MUTED,
            }}
          >
            {excerpt}
          </span>
        ) : null}
      </div>

      <div
        style={{
          display: "flex",
          paddingTop: 28,
          borderTop: `1px solid ${RULE}`,
        }}
      >
        <Eyebrow>{meta}</Eyebrow>
      </div>
    </div>
  );
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // The read is uncached; connection() marks this request-time so
  // cacheComponents doesn't try to prerender it.
  await connection();

  // Crawlers hit this endpoint with junk slugs and dead links, and a draft must
  // not leak its title through a card either. Both must still come back as a
  // branded image, never a throw.
  const post = await getPublishedPost(slug).catch(() => null);
  const fonts = await loadFonts();

  const card = post ? (
    <Card
      headline={truncate(post.title, 68)}
      excerpt={truncate(post.excerpt, 110)}
      meta={`~${post.readingMinutes} min read`}
    />
  ) : (
    <Card
      headline="This post isn't here anymore."
      excerpt={null}
      meta="intrv · ai interview practice"
    />
  );

  return new ImageResponse(card, {
    ...size,
    fonts: fonts.length > 0 ? fonts : undefined,
  });
}

import { cacheLife } from "next/cache";

/**
 * Shared parts of the Open Graph cards.
 *
 * Satori resolves neither our CSS variables nor oklch(), so the palette is
 * pinned here as the sRGB values those tokens compute to on paper. If
 * globals.css moves, these move with it — and now there is one place to move
 * them, rather than one per og route.
 *
 * Each route still owns its own card layout; only the palette, the font
 * loading and the three atoms every card uses live here.
 */

export const PAPER = "#fbfaf7";
export const INK = "#0f0d09";
export const MUTED = "#605d59";
export const ACCENT = "#d4ee40";
export const RULE = "#dfdeda";

export const DISPLAY = "Newsreader";
export const MONO = "JetBrains Mono";

export const OG_SIZE = { width: 1200, height: 630 };

export type OgFont = {
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

export async function loadOgFonts(): Promise<OgFont[]> {
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
      } satisfies OgFont;
    }),
  );

  return loaded.filter((face) => face !== null);
}

/** Satori has no line clamp we can trust, so the measure is enforced up front. */
export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

export function Wordmark() {
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

export function Eyebrow({ children }: { children: string }) {
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

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <Eyebrow>{label}</Eyebrow>
      <span style={{ fontFamily: MONO, fontSize: 26, color: INK }}>
        {value}
      </span>
    </div>
  );
}

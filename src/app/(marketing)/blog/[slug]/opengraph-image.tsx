import { ImageResponse } from "next/og";
import { connection } from "next/server";
import {
  DISPLAY,
  Eyebrow,
  INK,
  loadOgFonts,
  MUTED,
  OG_SIZE,
  PAPER,
  RULE,
  truncate,
  Wordmark,
} from "@/lib/og";
import { getPublishedPost } from "@/server/dal/blog";

export const alt = "An Intrv post";
export const size = OG_SIZE;
export const contentType = "image/png";

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
  const fonts = await loadOgFonts();

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

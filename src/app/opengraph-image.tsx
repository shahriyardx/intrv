import { ImageResponse } from "next/og";
import {
  ACCENT,
  DISPLAY,
  Eyebrow,
  INK,
  loadOgFonts,
  MUTED,
  OG_SIZE,
  PAPER,
  RULE,
} from "@/lib/og";

export const alt = "Intrv — practice interviews that tell you what to fix";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  const fonts = await loadOgFonts();

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

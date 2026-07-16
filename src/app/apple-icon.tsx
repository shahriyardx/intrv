import { ImageResponse } from "next/og";

// Apple touch icons must be a raster format, so this mirrors icon.svg through
// ImageResponse rather than being served as SVG.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * The same serif "i" as icon.svg — the tittle is the acid dot that closes the
 * wordmark in the header.
 *
 * Full-bleed and square on purpose: iOS applies its own squircle mask, so any
 * corner radius here would be rounded twice and leave a dark rim. Colours are
 * the computed sRGB of the --background / --foreground / --accent tokens.
 */
export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#0f0d09",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* tittle */}
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 34,
          background: "#d4ee40",
          marginBottom: 17,
        }}
      />
      {/* stem with its entry serif */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex" }}>
          <div style={{ width: 17, height: 14, background: "#fbfaf7" }} />
          <div style={{ width: 23, height: 14, background: "#fbfaf7" }} />
        </div>
        <div style={{ display: "flex" }}>
          <div style={{ width: 17, height: 45 }} />
          <div style={{ width: 23, height: 45, background: "#fbfaf7" }} />
        </div>
        {/* foot serif */}
        <div style={{ width: 74, height: 14, background: "#fbfaf7" }} />
      </div>
    </div>,
    size,
  );
}

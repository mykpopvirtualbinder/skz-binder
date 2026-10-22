import { ImageResponse } from "next/og";

export const alt = "My K-pop Binder · Collect · Trade · Connect";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "72px 80px",
          background: "#fffdf5",
          color: "#1c1420",
        }}
      >
        <div style={{ display: "flex", width: 120, height: 10, borderRadius: 99, background: "#e85d9a", marginBottom: 36 }} />
        <div style={{ display: "flex", fontSize: 78, fontWeight: 800, letterSpacing: -2, lineHeight: 1 }}>
          My K-pop Binder
        </div>
        <div style={{ display: "flex", marginTop: 22, fontSize: 40, fontWeight: 700, color: "#8C659C" }}>
          Collect · Trade · Connect
        </div>
        <div style={{ display: "flex", marginTop: 28, fontSize: 30, fontWeight: 600, maxWidth: 900, lineHeight: 1.35 }}>
          Photocards, álbumes y market. De fans para fans.
        </div>
      </div>
    ),
    { ...size },
  );
}

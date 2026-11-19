import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// A speech bubble with a small heart: talk now, love sent soon.
export default function Icon() {
  const s = 180;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#c8553d",
        }}
      >
        <svg width={s * 0.62} height={s * 0.62} viewBox="0 0 100 100">
          <path
            d="M50 10c24 0 42 15 42 34S74 78 50 78c-5 0-10-.6-14-1.8L16 88l5-17C13 64 8 55 8 44 8 25 26 10 50 10z"
            fill="#faf6f0"
          />
          <path
            d="M50 60s-15-9-15-19c0-5 4-9 8.5-9 3 0 5.3 1.6 6.5 4 1.2-2.4 3.5-4 6.5-4 4.5 0 8.5 4 8.5 9 0 10-15 19-15 19z"
            fill="#c8553d"
          />
        </svg>
      </div>
    ),
    size,
  );
}

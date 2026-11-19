import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Talk Soon",
    short_name: "Talk Soon",
    description: "Say it out loud. Send it later.",
    start_url: "/",
    display: "standalone",
    background_color: "#faf6f0",
    theme_color: "#faf6f0",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}

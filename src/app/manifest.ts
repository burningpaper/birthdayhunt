import type { MetadataRoute } from "next";

/**
 * Lets the hunt be saved to the iPad's home screen as an app: its own icon
 * and name, opening full screen (no Safari bar) on the front page, which is
 * the start screen while a hunt is live.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Treasure Hunt",
    short_name: "Treasure Hunt",
    description: "A QR-code treasure hunt around the house.",
    start_url: "/",
    display: "standalone",
    orientation: "landscape",
    background_color: "#101c3c",
    theme_color: "#101c3c",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

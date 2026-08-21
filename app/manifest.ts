import type { MetadataRoute } from "next";

/**
 * The manifest, written for two readers.
 *
 * A browser is forgiving and will take the SVG. The Android packaging tools
 * are not: they need real PNGs at 192 and 512, and a maskable one whose mark
 * sits inside the safe circle — launchers crop it to whatever shape they like,
 * and an unpadded icon loses its edges.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "biblio — a living journal",
    short_name: "biblio",
    description:
      "Speak or type a raw thought; it becomes a coherent, self-organizing story of you.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F7F3EB",
    theme_color: "#F7F3EB",
    categories: ["lifestyle", "productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}

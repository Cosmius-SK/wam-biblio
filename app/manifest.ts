import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "wam-biblio — a living journal",
    short_name: "biblio",
    description:
      "Speak or type a raw thought; it becomes a coherent, self-organizing story of you.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F7F3EB",
    theme_color: "#F7F3EB",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}

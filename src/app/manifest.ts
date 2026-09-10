import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SIM KB DEVFANTA MELATI",
    short_name: "SIM KB Melati",
    description: "Sistem Informasi Manajemen KB DEVFANTA MELATI",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f8f5",
    theme_color: "#20584c",
    lang: "id",
  };
}
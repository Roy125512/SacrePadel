import type { MetadataRoute } from "next";

// Para instalar el sitio como app en el celular (ícono en la pantalla de
// inicio, abre a pantalla completa, sin barra del navegador).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sacré Pádel",
    short_name: "Sacré",
    description: "Reserva cancha, únete a partidos y sigue tu nivel en Sacré Pádel, Pátzcuaro.",
    start_url: "/reservar",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f0e9",
    theme_color: "#13110E",
    lang: "es-MX",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Reservar cancha", url: "/reservar" },
      { name: "Partidos abiertos", url: "/partidos" },
      { name: "Mi perfil", url: "/perfil" },
    ],
  };
}

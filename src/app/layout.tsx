import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import AppHeader from "@/components/AppHeader";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";

// Tipografías alojadas en el propio sitio (src/fonts): la política de
// seguridad (CSP) no permite cargar fuentes de otros dominios.
// Bodoni Moda — titulares: serif de alto contraste, editorial.
// Archivo — texto e interfaz, sobria y legible.
const display = localFont({
  src: [
    { path: "../fonts/bodoni-normal.woff2", weight: "400 900", style: "normal" },
    { path: "../fonts/bodoni-italic.woff2", weight: "400 900", style: "italic" },
  ],
  variable: "--font-display",
  display: "swap",
});

const body = localFont({
  src: "../fonts/archivo.woff2",
  weight: "400 900",
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://sacrepadel.com"),
  title: { default: "Sacré Pádel | Canchas de pádel en Pátzcuaro", template: "%s | Sacré Pádel" },
  description:
    "Club de pádel en Pátzcuaro, Michoacán. Reserva tu cancha en línea en segundos, paga en línea o en recepción.",
  openGraph: {
    type: "website",
    locale: "es_MX",
    siteName: "Sacré Pádel",
    title: "Sacré Pádel | Canchas de pádel en Pátzcuaro",
    description: "Reserva tu cancha de pádel en Pátzcuaro en línea.",
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-icon.png",
  },
};




export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${display.variable} ${body.variable} antialiased bg-background text-foreground`}>
        <AppHeader />
        {children}
        <Footer />
        <WhatsAppButton />
      </body>
    </html>
  );
}

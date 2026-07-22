"use client";

import Image from "next/image";
import { useScrollReveal } from "@/hooks/useScrollReveal";

type GalleryItem = {
  src: string;
  alt: string;
  /** Tailwind grid-span utility classes for the mosaic layout. */
  span: string;
  /** Optional overlaid caption, shown only on the large hero tile. */
  caption?: string;
};

const IMAGES: GalleryItem[] = [
  {
    src: "/images/gallery-night-01.jpg",
    alt: "Cancha Sacré iluminada de noche",
    span: "sm:col-span-2 sm:row-span-2",
    caption: "La cancha después del atardecer",
  },
  {
    src: "/images/detail-rackets-crossed.jpg",
    alt: "Palas de pádel cruzadas",
    span: "",
  },
  {
    src: "/images/gallery-sunset-fence.jpg",
    alt: "Atardecer tras la reja de la cancha",
    span: "",
  },
  {
    src: "/images/gallery-storm-day.jpg",
    alt: "Cancha bajo cielo de tormenta",
    span: "sm:col-span-2",
  },
  {
    src: "/images/detail-racket-balls.jpg",
    alt: "Pala y pelotas de pádel",
    span: "",
  },
  {
    src: "/images/gallery-court-night.jpg",
    alt: "Vista nocturna de la cancha Sacré",
    span: "",
  },
  {
    src: "/images/gallery-net-sunset-view.jpg",
    alt: "Vista de la red y la cancha al atardecer",
    span: "sm:col-span-2",
  },
  {
    src: "/images/gallery-court-dusk-wide.jpg",
    alt: "Cancha completa al anochecer, con reflectores encendidos",
    span: "",
  },
];

export default function PhotoGallery() {
  const revealRef = useScrollReveal<HTMLDivElement>();

  return (
    <section id="galeria" className="w-full scroll-mt-16 bg-[var(--background)] py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6">
        {/* Header sits to the side and reads across the top edge, not a
            centered eyebrow→title→subtitle stack. */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <h2 className="font-display max-w-md text-4xl leading-[1.02] sm:text-6xl">
            <span className="font-light italic">El club,</span>{" "}
            <span className="font-black">sin filtros.</span>
          </h2>
          <p className="max-w-xs text-sm leading-relaxed text-[var(--muted)] sm:text-right">
            Fotos reales de la cancha: de día, de noche y bajo el cielo de
            Pátzcuaro.
          </p>
        </div>

        <div
          ref={revealRef}
          className="reveal mt-12 grid auto-rows-[180px] grid-cols-2 gap-3 sm:auto-rows-[220px] sm:grid-cols-4"
        >
          {IMAGES.map((img, i) => (
            <div
              key={img.src}
              className={`group relative overflow-hidden rounded-md ${img.span}`}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <Image
                src={img.src}
                alt={img.alt}
                fill
                sizes="(max-width: 640px) 50vw, 25vw"
                className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              />
              {img.caption ? (
                <>
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[rgba(30,20,14,0.7)] via-transparent to-transparent" />
                  <p className="font-display pointer-events-none absolute bottom-4 left-4 right-4 text-lg font-semibold italic leading-tight text-[var(--dark-foreground)] sm:text-2xl">
                    {img.caption}
                  </p>
                </>
              ) : (
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[rgba(30,20,14,0.35)] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight, Expand } from "lucide-react";
import { useScrollReveal } from "@/hooks/useScrollReveal";

type GalleryItem = {
  src: string;
  alt: string;
  /** Tailwind grid-span utility classes for the mobile (2-col) mosaic. */
  span: string;
  /** Explicit grid placement for the desktop (4-col) mosaic — hand-placed
      so every cell is filled, since spans alone can't guarantee a
      gap-free bento layout once tiles vary in both width and height. */
  place: string;
  /** Optional overlaid caption, shown only on the large hero tile. */
  caption?: string;
  /** Optional object-position override for the cover crop (default: center). */
  focus?: string;
};

// Order here drives the mobile (2-col) layout via `span`: every pair of
// spans must sum to a multiple of 2 columns so nothing leaves a gap.
// Desktop placement is independent — `place` pins each tile explicitly.
const IMAGES: GalleryItem[] = [
  {
    src: "/images/gallery-net-hero.jpg",
    alt: "La red al atardecer, minutos antes de jugar",
    span: "col-span-2 row-span-2",
    place: "sm:col-start-1 sm:col-end-3 sm:row-start-1 sm:row-end-3",
    focus: "50% 78%",
  },
  {
    src: "/images/gallery-racket-ball-sunset.jpg",
    alt: "Pala y pelota sobre la cancha al atardecer",
    span: "col-span-1 row-span-1",
    place: "sm:col-start-3 sm:col-end-4 sm:row-start-3 sm:row-end-4",
  },
  {
    src: "/images/gallery-crossed-rackets-smile.jpg",
    alt: "Dos palas cruzadas y pelotas sobre la cancha",
    span: "col-span-1 row-span-1",
    place: "sm:col-start-3 sm:col-end-4 sm:row-start-4 sm:row-end-5",
  },
  {
    src: "/images/gallery-racket-balls-top.jpg",
    alt: "Pala y pelotas vistas desde arriba",
    span: "col-span-2 row-span-1",
    place: "sm:col-start-1 sm:col-end-3 sm:row-start-3 sm:row-end-4",
  },
  {
    src: "/images/gallery-sunset-light-pole.jpg",
    alt: "Cancha bajo un cielo de atardecer con el reflector encendido",
    span: "col-span-1 row-span-2",
    place: "sm:col-start-3 sm:col-end-4 sm:row-start-1 sm:row-end-3",
  },
  {
    src: "/images/gallery-fence-mesh.jpg",
    alt: "Malla de la cancha en primer plano",
    span: "col-span-1 row-span-2",
    place: "sm:col-start-4 sm:col-end-5 sm:row-start-1 sm:row-end-3",
  },
  {
    src: "/images/gallery-two-courts-mountain.jpg",
    alt: "Vista de las canchas con los cerros de Pátzcuaro de fondo",
    span: "col-span-2 row-span-1",
    place: "sm:col-start-1 sm:col-end-3 sm:row-start-4 sm:row-end-5",
  },
  {
    src: "/images/gallery-rackets-hanging.jpg",
    alt: "Palas colgadas en la malla con la cancha de fondo",
    span: "col-span-2 row-span-1",
    place: "sm:col-start-4 sm:col-end-5 sm:row-start-3 sm:row-end-5",
  },
];

export default function PhotoGallery() {
  const revealRef = useScrollReveal<HTMLDivElement>();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  useEffect(() => {
    if (openIndex === null) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenIndex(null);
      if (e.key === "ArrowRight") setOpenIndex((i) => (i === null ? i : (i + 1) % IMAGES.length));
      if (e.key === "ArrowLeft") setOpenIndex((i) => (i === null ? i : (i - 1 + IMAGES.length) % IMAGES.length));
    }

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [openIndex]);

  const active = openIndex !== null ? IMAGES[openIndex] : null;

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
            Fotos reales de la cancha. Toca cualquiera para verla en grande.
          </p>
        </div>

        <div
          ref={revealRef}
          className="reveal mt-12 grid auto-rows-[150px] grid-cols-2 gap-3 sm:auto-rows-[190px] sm:grid-cols-4 sm:gap-4"
        >
          {IMAGES.map((img, i) => (
            <button
              key={img.src}
              type="button"
              onClick={() => setOpenIndex(i)}
              aria-label={`Ampliar foto: ${img.alt}`}
              className={`group relative block w-full overflow-hidden rounded-md text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] ${img.span} ${img.place}`}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <Image
                src={img.src}
                alt={img.alt}
                fill
                sizes="(max-width: 640px) 50vw, 25vw"
                className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                style={img.focus ? { objectPosition: img.focus } : undefined}
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
              <span className="pointer-events-none absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(30,20,14,0.45)] opacity-0 backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-100">
                <Expand className="h-4 w-4 text-white" strokeWidth={2} />
              </span>
            </button>
          ))}
        </div>
      </div>

      {active && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(20,14,10,0.94)] p-4 animate-fade-in sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label={active.alt}
          onClick={() => setOpenIndex(null)}
        >
          <button
            type="button"
            onClick={() => setOpenIndex(null)}
            aria-label="Cerrar"
            className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white sm:right-6 sm:top-6"
          >
            <X className="h-6 w-6" strokeWidth={2} />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpenIndex((i) => (i === null ? i : (i - 1 + IMAGES.length) % IMAGES.length));
            }}
            aria-label="Foto anterior"
            className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white sm:left-6"
          >
            <ChevronLeft className="h-7 w-7" strokeWidth={2} />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpenIndex((i) => (i === null ? i : (i + 1) % IMAGES.length));
            }}
            aria-label="Foto siguiente"
            className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white sm:right-6"
          >
            <ChevronRight className="h-7 w-7" strokeWidth={2} />
          </button>

          <div
            className="relative h-[75vh] w-full max-w-4xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              key={active.src}
              src={active.src}
              alt={active.alt}
              fill
              sizes="90vw"
              className="object-contain"
              priority
            />
          </div>

          <p className="absolute bottom-6 left-1/2 max-w-md -translate-x-1/2 text-center text-sm text-white/70">
            {(openIndex ?? 0) + 1} / {IMAGES.length}
          </p>
        </div>
      )}
    </section>
  );
}

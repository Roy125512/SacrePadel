"use client";

import { useEffect } from "react";
import Lenis from "lenis";

/**
 * Scroll suave con inercia (Lenis), solo donde se monta (la portada).
 * Respeta "reducir movimiento" y deja los enlaces #ancla funcionando.
 */
export default function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({ duration: 1.15, anchors: { offset: -64 } });
    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, []);
  return null;
}

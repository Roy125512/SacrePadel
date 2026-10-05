"use client";

import { useEffect, useRef } from "react";

/**
 * Cursor propio (solo con mouse): un punto y un anillo que lo sigue con
 * retraso; el anillo crece sobre enlaces y botones. En pantallas táctiles
 * o con "reducir movimiento" no se muestra.
 */
export default function Cursor() {
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    document.documentElement.classList.add("has-custom-cursor");

    const pos = { x: -100, y: -100 };
    const ringPos = { x: -100, y: -100 };
    let hover = false;
    let raf = 0;

    const onMove = (e: PointerEvent) => {
      pos.x = e.clientX;
      pos.y = e.clientY;
      const el = e.target as Element | null;
      hover = !!el?.closest("a, button, [role=button], input, select, label");
    };
    const loop = () => {
      ringPos.x += (pos.x - ringPos.x) * 0.18;
      ringPos.y += (pos.y - ringPos.y) * 0.18;
      if (dot.current) dot.current.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
      if (ring.current) {
        ring.current.style.transform = `translate3d(${ringPos.x}px, ${ringPos.y}px, 0) scale(${hover ? 1.9 : 1})`;
      }
      raf = requestAnimationFrame(loop);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
      document.documentElement.classList.remove("has-custom-cursor");
    };
  }, []);

  return (
    <div aria-hidden className="custom-cursor pointer-events-none fixed left-0 top-0 z-[9999] hidden mix-blend-difference [.has-custom-cursor_&]:block">
      <div ref={dot} className="absolute -ml-[3px] -mt-[3px] h-1.5 w-1.5 rounded-full bg-white" />
      <div ref={ring} className="absolute -ml-4 -mt-4 h-8 w-8 rounded-full border border-white transition-[scale] duration-200" style={{ transition: "transform 0s" }} />
    </div>
  );
}

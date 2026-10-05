"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * true en cuanto el elemento queda a menos de `margin` de la pantalla, y se
 * queda en true. Sirve para no cargar escenas 3D pesadas hasta que el
 * visitante se acerca a ellas.
 */
export function useNearViewport(ref: RefObject<HTMLElement | null>, margin = "100% 0px") {
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: margin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, margin, near]);

  return near;
}

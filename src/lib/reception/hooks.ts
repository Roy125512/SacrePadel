"use client";

import { useEffect, useState } from "react";
import { DEFAULT_COURTS } from "./utils";

export function useDebounce<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return debounced;
}

/**
 * Número de canchas activas (para calcular la capacidad/ocupación). Mientras
 * carga, o si falla, usa DEFAULT_COURTS.
 */
export function useActiveCourtCount() {
  const [count, setCount] = useState(DEFAULT_COURTS);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/reception/courts")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const n = Array.isArray(j?.courts) ? j.courts.length : 0;
        if (!cancelled && n > 0) setCount(n);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return count;
}

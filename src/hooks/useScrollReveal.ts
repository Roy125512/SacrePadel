"use client";

import { useCallback, useRef } from "react";

/**
 * useScrollReveal
 *
 * Returns a ref callback to attach to any element carrying the `.reveal`
 * class. When that element scrolls into view it gets `.is-visible` toggled
 * on (triggering the slideUp reveal animation defined in globals.css) and
 * the observer disconnects so the animation only ever fires once.
 *
 * Purely presentational — no state, no side effects beyond the class toggle.
 */
export function useScrollReveal<T extends HTMLElement = HTMLElement>() {
  const observerRef = useRef<IntersectionObserver | null>(null);

  return useCallback((node: T | null) => {
    // Clean up any previous observer if the node changes/unmounts.
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    if (!node) return;

    // Respect users who prefer no motion — just show the element.
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      node.classList.add("is-visible");
      return;
    }

    if (typeof IntersectionObserver === "undefined") {
      node.classList.add("is-visible");
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.disconnect();
            observerRef.current = null;
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -80px 0px" }
    );

    observer.observe(node);
    observerRef.current = observer;
  }, []);
}

export default useScrollReveal;

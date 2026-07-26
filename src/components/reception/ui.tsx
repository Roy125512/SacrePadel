"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function KpiCard(props: { title: string; value: string; valueClass?: string }) {
  return (
    <div className="card p-5">
      <div className="text-xs" style={{ color: "rgba(30,27,24,0.60)" }}>
        {props.title}
      </div>
      <div className={`mt-2 text-3xl font-semibold ${props.valueClass ?? ""}`} style={{ color: "var(--foreground)" }}>
        {props.value}
      </div>
    </div>
  );
}

export function MiniStat(props: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-white p-4" style={{ borderColor: "rgba(120,46,21,0.10)" }}>
      <div className="text-xs" style={{ color: "rgba(30,27,24,0.60)" }}>
        {props.label}
      </div>
      <div className="mt-2 text-base font-semibold" style={{ color: "var(--foreground)" }}>
        {props.value}
      </div>
    </div>
  );
}

export function Pill(props: { text: string; tone?: "ok" | "warn" | "danger" | "brand" | "neutral" }) {
  const tone = props.tone ?? "neutral";

  const map: Record<string, React.CSSProperties> = {
    ok: { background: "rgba(16,185,129,0.12)", borderColor: "rgba(16,185,129,0.25)", color: "rgb(6,95,70)" },
    warn: { background: "rgba(245,158,11,0.12)", borderColor: "rgba(245,158,11,0.25)", color: "rgb(146,64,14)" },
    danger: { background: "rgba(239,68,68,0.10)", borderColor: "rgba(239,68,68,0.22)", color: "rgb(153,27,27)" },
    brand: { background: "rgba(253,238,232,1)", borderColor: "rgba(175,78,43,0.22)", color: "rgba(120,46,21,0.95)" },
    neutral: { background: "rgba(255,255,255,0.70)", borderColor: "rgba(120,46,21,0.14)", color: "rgba(30,27,24,0.85)" },
  };

  return (
    <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium" style={map[tone]}>
      {props.text}
    </span>
  );
}

export function IconButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & { text: string; variant?: "primary" | "secondary" }
) {
  const variant = props.variant ?? "secondary";
  return (
    <button {...props} className={`${variant === "primary" ? "btn-primary" : "btn-secondary"} ${props.className ?? ""}`}>
      {props.text}
    </button>
  );
}

export function Menu({
  open,
  anchorRef,
  children,
  onClose,
}: {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement>;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!open) return;
      const anchorEl = anchorRef.current;
      const menuEl = menuRef.current;

      if (anchorEl && anchorEl.contains(e.target as Node)) return;
      if (menuEl && menuEl.contains(e.target as Node)) return;

      onClose();
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open, anchorRef, onClose]);

  useEffect(() => {
    if (!open) return;
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ top: r.bottom + 8, left: r.left });
  }, [open, anchorRef]);

  // Recorre el menú para que quepa en la pantalla — sin esto, botones cerca
  // del borde derecho o de abajo (como "Cancelar", casi siempre la columna
  // más a la derecha de la tabla) abren el menú parcialmente fuera de vista.
  // Corre después de montar (useLayoutEffect, antes del pintado) para medir
  // el tamaño real del menú y no causar parpadeo.
  useLayoutEffect(() => {
    if (!open || !pos) return;
    const menuEl = menuRef.current;
    const anchorEl = anchorRef.current;
    if (!menuEl || !anchorEl) return;

    const margin = 8;
    const menuRect = menuEl.getBoundingClientRect();
    const anchorRect = anchorEl.getBoundingClientRect();

    let left = Math.min(pos.left, window.innerWidth - menuRect.width - margin);
    left = Math.max(margin, left);

    let top = pos.top;
    const fitsBelow = anchorRect.bottom + margin + menuRect.height <= window.innerHeight - margin;
    if (!fitsBelow) {
      const above = anchorRect.top - margin - menuRect.height;
      top = above >= margin ? above : margin;
    }

    if (left !== pos.left || top !== pos.top) {
      setPos({ top, left });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pos?.top, pos?.left]);

  if (!open || !pos) return null;

  return createPortal(
    <div
      ref={menuRef}
      className="z-50 min-w-[220px] rounded-2xl border bg-white p-2 shadow-2xl"
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        borderColor: "rgba(120,46,21,0.12)",
        boxShadow: "0 20px 50px rgba(30,27,24,0.14)",
      }}
    >
      {children}
    </div>,
    document.body
  );
}

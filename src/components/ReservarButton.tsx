"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { LogIn, User } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

/**
 * Any "Reservar" call-to-action that can be reached without a session
 * (Hero, section nav, pricing, footer) must not link straight to /reservar:
 * that page immediately router.replace()s an anonymous, non-guest visitor
 * back to /inicio, which reads as "the button does nothing". This component
 * checks session state first and only then decides between a direct link
 * and a small choice popover (Iniciar sesión / Continuar como invitado).
 *
 * The popover is rendered through a portal into document.body and
 * positioned with `fixed` coordinates computed from the trigger's own
 * bounding rect. It must NOT be a normal in-flow absolutely-positioned
 * child: several of this button's placements sit inside an ancestor with
 * clipped/scrollable overflow (SectionNav's `overflow-x-auto`, Hero's
 * `overflow-hidden`), which was cutting the popover down to a tiny
 * scrollable sliver instead of showing it in full.
 */
export default function ReservarButton({
  className,
  children,
  align = "left",
}: {
  className?: string;
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  const [hasSession, setHasSession] = useState(false);
  const [checking, setChecking] = useState(true);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const POPOVER_WIDTH = 288; // matches w-72

  const updateCoords = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setCoords({
      top: rect.bottom + 8,
      left: align === "right" ? rect.right - POPOVER_WIDTH : rect.left,
    });
  }, [align]);

  useEffect(() => {
    (async () => {
      const { data } = await supabaseBrowser.auth.getSession();
      setHasSession(!!data.session?.user);
      setChecking(false);
    })();

    const { data: sub } = supabaseBrowser.auth.onAuthStateChange((_event: string, session: any) => {
      setHasSession(!!session?.user);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!open) return;

    updateCoords();

    function onClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }

    function onReposition() {
      updateCoords();
    }

    document.addEventListener("mousedown", onClickOutside);
    window.addEventListener("scroll", onReposition, true);
    window.addEventListener("resize", onReposition);

    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("scroll", onReposition, true);
      window.removeEventListener("resize", onReposition);
    };
  }, [open, updateCoords]);

  // Session confirmed: behave like a normal link straight to the booking page.
  if (!checking && hasSession) {
    return (
      <Link href="/reservar" className={className}>
        {children}
      </Link>
    );
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={className}
        onClick={() => setOpen((v) => !v)}
      >
        {children}
      </button>

      {open &&
        coords &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popoverRef}
            className="fixed z-[100] w-72 rounded-md border border-[rgba(120,46,21,0.15)] bg-[var(--surface)] p-4 text-left shadow-2xl"
            style={{ top: coords.top, left: coords.left }}
          >
            <p className="text-sm font-semibold text-[var(--foreground)]">
              ¿Cómo quieres reservar?
            </p>

            <Link
              href="/login?mode=login&next=%2Freservar"
              className="btn-primary mt-3 flex w-full items-center justify-center gap-2 py-2.5 text-sm"
            >
              <LogIn className="h-4 w-4" />
              Iniciar sesión
            </Link>

            <Link
              href="/reservar?mode=guest"
              className="btn-secondary mt-2 flex w-full items-center justify-center gap-2 py-2.5 text-sm"
            >
              <User className="h-4 w-4" />
              Continuar como invitado
            </Link>

            <Link
              href="/login?mode=signup&next=%2Fperfil"
              className="mt-3 block text-center text-xs font-medium text-[var(--muted)] underline decoration-[rgba(120,46,21,0.3)] underline-offset-4 transition hover:text-[var(--brand)]"
            >
              ¿Aún no tienes cuenta? Crear cuenta
            </Link>
          </div>,
          document.body
        )}
    </>
  );
}

import Link from "next/link";
import type { ReactNode } from "react";

export const LEGAL_UPDATED = "16 de octubre de 2026";

/** Marco común del aviso de privacidad y los términos: texto largo y legible.
 *  (.font-display es una clase de globals.css, no una utilidad: los h2 llevan su tipografía a mano.) */
export default function LegalPage({ kicker, title, children }: { kicker: string; title: string; children: ReactNode }) {
  return (
    <div className="page">
      <article
        className="mx-auto max-w-3xl px-6 pb-24 pt-28 leading-relaxed sm:pt-32
          [&_a]:underline [&_a]:underline-offset-4
          [&_h2]:font-[family-name:var(--font-display),Georgia,serif] [&_h2]:tracking-[-0.015em] [&_h2]:mt-12 [&_h2]:text-3xl [&_h2]:leading-tight
          [&_h3]:mt-6 [&_h3]:font-semibold
          [&_li]:mt-1.5 [&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:pl-6
          [&_p]:mt-4 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6"
      >
        <p className="text-[0.72rem] uppercase tracking-[0.3em] text-[var(--brand)]">{kicker}</p>
        <h1 className="font-display mt-5 text-5xl leading-[1.02] sm:text-6xl">{title}</h1>
        <p className="text-sm text-[var(--muted)]">Última actualización: {LEGAL_UPDATED}</p>
        {children}
        <p className="mt-16 border-t pt-6 text-sm text-[var(--muted)]" style={{ borderColor: "var(--line)" }}>
          Ver también: <Link href="/privacidad">Aviso de privacidad</Link> · <Link href="/terminos">Términos y condiciones</Link>
        </p>
      </article>
    </div>
  );
}

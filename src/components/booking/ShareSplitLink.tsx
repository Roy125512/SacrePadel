"use client";

import { useState } from "react";

/**
 * Compartir la liga del pago dividido: WhatsApp (lo que más se usa para armar
 * partidos) y copiar. En celular, "Compartir" abre la hoja nativa.
 */
export default function ShareSplitLink({
  url,
  message,
  compact = false,
  onDark = false,
}: {
  url: string;
  message: string;
  compact?: boolean;
  /** Sobre fondo oscuro: botones claros. */
  onDark?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const text = `${message} ${url}`;
  const size = compact ? "!px-4 !py-2 !text-[0.68rem]" : "";
  const primary = onDark ? { background: "#F6F0E6", color: "#13110E", borderColor: "#F6F0E6" } : undefined;
  const secondary = onDark ? { background: "transparent", color: "#F6F0E6", borderColor: "rgba(246,240,230,0.5)" } : undefined;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copia la liga:", url);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <a
        className={`btn-primary ${size}`}
        style={primary}
        href={`https://wa.me/?text=${encodeURIComponent(text)}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        Enviar por WhatsApp
      </a>
      <button type="button" className={`btn-secondary ${size}`} style={secondary} onClick={copy}>
        {copied ? "¡Liga copiada!" : "Copiar liga"}
      </button>
    </div>
  );
}

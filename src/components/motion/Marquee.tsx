/**
 * Marquesina infinita con texto gigante en contorno (como en landonorris.com).
 * El contenido se duplica para que el ciclo no tenga cortes.
 */
export default function Marquee({ items, dark = false }: { items: string[]; dark?: boolean }) {
  const row = items.map((t, i) => (
    <span key={i} className="flex items-center">
      <span className="font-display px-8 text-[clamp(3.5rem,9vw,8.5rem)] leading-none" style={{ WebkitTextStroke: `1px ${dark ? "rgba(241,236,227,.55)" : "rgba(19,17,14,.45)"}`, color: "transparent" }}>
        {t}
      </span>
      <span aria-hidden className="text-[clamp(1.2rem,2.4vw,2rem)]" style={{ color: "var(--brand)" }}>✦</span>
    </span>
  ));
  return (
    <div className="overflow-hidden py-10" style={{ background: dark ? "var(--dark)" : "var(--background)" }} aria-hidden>
      <div className="marquee-track flex w-max whitespace-nowrap">
        {row}
        {row}
      </div>
    </div>
  );
}

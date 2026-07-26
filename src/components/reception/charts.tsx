"use client";

import React, { useId, useRef, useState } from "react";

/** Redondea hacia arriba a un número "bonito" (1/2/5 × 10^n) para que los
 * ejes no muestren cosas como $1,234.57 — así el ojo puede leer la escala
 * de un vistazo. */
function niceMax(value: number) {
  if (value <= 0) return 1;
  const exponent = Math.floor(Math.log10(value));
  const fraction = value / Math.pow(10, exponent);
  let niceFraction: number;
  if (fraction <= 1) niceFraction = 1;
  else if (fraction <= 2) niceFraction = 2;
  else if (fraction <= 5) niceFraction = 5;
  else niceFraction = 10;
  return niceFraction * Math.pow(10, exponent);
}

/* ===================== ÁREA / TENDENCIA ===================== */

const VB_W = 800;
const VB_H = 260;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;
const PAD_LEFT = 58;
const PAD_RIGHT = 12;

export type TrendPoint = { label: string; value: number };

export function AreaTrendChart({
  data,
  color = "var(--brand)",
  formatValue = (v: number) => String(Math.round(v)),
  emptyLabel = "Sin datos en este periodo",
}: {
  data: TrendPoint[];
  color?: string;
  formatValue?: (v: number) => string;
  emptyLabel?: string;
}) {
  const rawId = useId();
  const gradId = `trend-grad-${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  const n = data.length;
  const total = data.reduce((a, d) => a + d.value, 0);
  const rawMax = Math.max(1, ...data.map((d) => d.value));
  const scaleMax = niceMax(rawMax);
  const innerW = VB_W - PAD_LEFT - PAD_RIGHT;
  const innerH = VB_H - PAD_TOP - PAD_BOTTOM;

  const xAt = (i: number) => (n <= 1 ? PAD_LEFT + innerW / 2 : PAD_LEFT + (i / (n - 1)) * innerW);
  const yAt = (v: number) => PAD_TOP + innerH - (v / scaleMax) * innerH;

  if (n === 0 || total === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm" style={{ color: "var(--muted)" }}>
        {emptyLabel}
      </div>
    );
  }

  const linePath = data.map((d, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(2)} ${yAt(d.value).toFixed(2)}`).join(" ");
  const baseline = PAD_TOP + innerH;
  const areaPath = `${linePath} L ${xAt(n - 1).toFixed(2)} ${baseline.toFixed(2)} L ${xAt(0).toFixed(2)} ${baseline.toFixed(2)} Z`;

  // Eje Y: 5 líneas guía (0%, 25%, 50%, 75%, 100% de la escala "bonita"),
  // cada una con su valor a la izquierda — así se puede leer el tamaño de
  // un pico sin necesidad de pasar el mouse.
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((frac) => ({
    value: scaleMax * frac,
    y: yAt(scaleMax * frac),
  }));

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg || n === 0) return;
    const rect = svg.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * VB_W;
    let closest = 0;
    let closestDist = Infinity;
    for (let i = 0; i < n; i++) {
      const dist = Math.abs(xAt(i) - relX);
      if (dist < closestDist) {
        closestDist = dist;
        closest = i;
      }
    }
    setHover(closest);
  }

  const hoveredPoint = hover !== null ? data[hover] : null;
  const tooltipX = hover !== null ? xAt(hover) : 0;
  const tooltipAnchor = tooltipX > VB_W - 140 ? "end" : tooltipX < PAD_LEFT + 100 ? "start" : "middle";
  const labelEvery = Math.max(1, Math.ceil(n / 6));

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height: 220 }}
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.32" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Líneas guía + valores del eje Y */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line
              x1={PAD_LEFT}
              y1={t.y}
              x2={VB_W - PAD_RIGHT}
              y2={t.y}
              stroke="rgba(120,46,21,0.10)"
              strokeWidth={1}
              strokeDasharray={i === 0 ? undefined : "3 3"}
            />
            <text x={PAD_LEFT - 10} y={t.y} fontSize={11} textAnchor="end" dominantBaseline="middle" fill="rgba(30,27,24,0.55)">
              {formatValue(t.value)}
            </text>
          </g>
        ))}

        <path d={areaPath} fill={`url(#${gradId})`} />
        <path d={linePath} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

        {hover !== null && (
          <line
            x1={xAt(hover)}
            y1={PAD_TOP}
            x2={xAt(hover)}
            y2={baseline}
            stroke={color}
            strokeWidth={1}
            strokeDasharray="3 3"
            opacity={0.5}
          />
        )}

        {data.map((d, i) => (
          <circle
            key={i}
            cx={xAt(i)}
            cy={yAt(d.value)}
            r={hover === i ? 4.5 : 0}
            fill={color}
            stroke="#fff"
            strokeWidth={1.5}
          />
        ))}

        {data.map((d, i) =>
          i % labelEvery === 0 || i === n - 1 ? (
            <text key={i} x={xAt(i)} y={VB_H - 8} fontSize={11} textAnchor="middle" fill="rgba(30,27,24,0.55)">
              {d.label}
            </text>
          ) : null
        )}
      </svg>

      {hoveredPoint && (
        <div
          className="pointer-events-none absolute top-1 rounded-lg border bg-white px-3 py-1.5 text-xs shadow-lg"
          style={{
            left: `${(tooltipX / VB_W) * 100}%`,
            transform:
              tooltipAnchor === "middle" ? "translateX(-50%)" : tooltipAnchor === "end" ? "translateX(-100%)" : "translateX(0)",
            borderColor: "rgba(120,46,21,0.14)",
          }}
        >
          <div className="font-semibold" style={{ color: "var(--foreground)" }}>
            {formatValue(hoveredPoint.value)}
          </div>
          <div style={{ color: "var(--muted)" }}>{hoveredPoint.label}</div>
        </div>
      )}
    </div>
  );
}

/* ===================== DONUT ===================== */

export type DonutSegment = { label: string; value: number; color: string };

export function DonutChart({
  segments,
  size = 156,
  thickness = 22,
  emptyLabel = "Sin datos",
  formatValue = (v: number) => String(Math.round(v)),
  centerLabel = "Total",
}: {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  emptyLabel?: string;
  formatValue?: (v: number) => string;
  centerLabel?: string;
}) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;
  const center = size / 2;

  let cumulative = 0;

  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle cx={center} cy={center} r={r} fill="none" stroke="rgba(120,46,21,0.08)" strokeWidth={thickness} />
          {total > 0 &&
            segments
              .filter((s) => s.value > 0)
              .map((s, i) => {
                const frac = s.value / total;
                const dash = frac * circumference;
                const gap = circumference - dash;
                const offset = -cumulative * circumference;
                cumulative += frac;
                return (
                  <circle
                    key={i}
                    cx={center}
                    cy={center}
                    r={r}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={thickness}
                    strokeDasharray={`${dash} ${gap}`}
                    strokeDashoffset={offset}
                  />
                );
              })}
        </svg>

        {/* Total al centro — sin rotar, superpuesto sobre el donut */}
        {total > 0 && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
              {formatValue(total)}
            </span>
            <span className="text-[10px]" style={{ color: "var(--muted)" }}>
              {centerLabel}
            </span>
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-1.5">
        {total === 0 ? (
          <div className="text-sm" style={{ color: "var(--muted)" }}>
            {emptyLabel}
          </div>
        ) : (
          segments.map((s, i) => {
            const pct = Math.round((s.value / total) * 100);
            return (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                <span className="min-w-0 flex-1 truncate" style={{ color: "var(--foreground)" }}>
                  {s.label}
                </span>
                <span className="shrink-0 text-xs" style={{ color: "var(--muted)" }}>
                  {formatValue(s.value)}
                </span>
                <span className="shrink-0 w-10 text-right font-semibold" style={{ color: "var(--foreground)" }}>
                  {pct}%
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ===================== BARRAS HORIZONTALES ===================== */

export type BarItem = { label: string; value: number; sublabel?: string; color?: string };

export function HBarList({
  items,
  formatValue = (v: number) => String(Math.round(v)),
  color = "var(--brand)",
  emptyLabel = "Sin datos",
}: {
  items: BarItem[];
  formatValue?: (v: number) => string;
  color?: string;
  emptyLabel?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  const scaleMax = niceMax(max);

  if (items.length === 0) {
    return (
      <div className="text-sm" style={{ color: "var(--muted)" }}>
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Referencia del eje: qué tan larga es una barra al 100% */}
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>
        <span>0</span>
        <span>hasta {formatValue(scaleMax)}</span>
      </div>

      {items.map((it, i) => {
        const pct = Math.max(2, (it.value / scaleMax) * 100);
        return (
          <div key={i}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-medium" style={{ color: "var(--foreground)" }}>
                {it.label}
                {it.sublabel && (
                  <span className="ml-1.5 font-normal" style={{ color: "var(--muted)" }}>
                    {it.sublabel}
                  </span>
                )}
              </span>
              <span className="shrink-0 font-semibold" style={{ color: "var(--foreground)" }}>
                {formatValue(it.value)}
              </span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full" style={{ background: "rgba(120,46,21,0.08)" }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, background: it.color ?? color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ===================== BARRAS VERTICALES POR CATEGORÍA ===================== */
/* Como HourlyBarChart pero con etiquetas/valores genéricos (no horas del
   día) — se reutiliza para "ocupación por día de la semana" y "línea de
   tiempo anual", donde el orden de las barras importa y no debe reordenarse
   por tamaño (a diferencia de HBarList). */

export type CategoryPoint = { label: string; value: number };

export function CategoryBarChart({
  data,
  color = "var(--brand)",
  formatValue = (v: number) => String(Math.round(v)),
  emptyLabel = "Sin datos en este periodo",
}: {
  data: CategoryPoint[];
  color?: string;
  formatValue?: (v: number) => string;
  emptyLabel?: string;
}) {
  const rawMax = Math.max(1, ...data.map((d) => d.value));
  const scaleMax = niceMax(rawMax);
  const CHART_H = 118;

  if (data.length === 0) {
    return (
      <div className="flex h-[140px] items-center justify-center text-sm" style={{ color: "var(--muted)" }}>
        {emptyLabel}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-end gap-1.5" style={{ height: CHART_H + 22 }}>
        {data.map((d, i) => {
          const h = d.value > 0 ? Math.max(4, (d.value / scaleMax) * CHART_H) : 0;
          return (
            <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1" style={{ height: CHART_H + 22 }}>
              <span className="text-[10px] font-medium" style={{ color: d.value > 0 ? "var(--foreground)" : "transparent" }}>
                {d.value > 0 ? formatValue(d.value) : "0"}
              </span>
              <div
                className="w-full rounded-t-sm transition-all duration-500"
                style={{ height: h, background: d.value > 0 ? color : "rgba(120,46,21,0.08)" }}
                title={`${d.label} · ${formatValue(d.value)}`}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex items-center gap-1.5 border-t pt-1.5" style={{ borderColor: "rgba(120,46,21,0.10)" }}>
        {data.map((d, i) => (
          <span key={i} className="flex-1 text-center text-[10px]" style={{ color: "var(--muted)" }}>
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ===================== HORAS PICO ===================== */

export function HourlyBarChart({
  buckets,
  color = "var(--brand)",
}: {
  buckets: { hour: number; count: number }[];
  color?: string;
}) {
  const rawMax = Math.max(1, ...buckets.map((b) => b.count));
  const scaleMax = niceMax(rawMax);
  const CHART_H = 118;

  return (
    <div>
      <div className="flex items-end gap-1.5" style={{ height: CHART_H + 22 }}>
        {buckets.map((b) => {
          const h = b.count > 0 ? Math.max(4, (b.count / scaleMax) * CHART_H) : 0;
          return (
            <div key={b.hour} className="flex flex-1 flex-col items-center justify-end gap-1" style={{ height: CHART_H + 22 }}>
              <span className="text-[10px] font-medium" style={{ color: b.count > 0 ? "var(--foreground)" : "transparent" }}>
                {b.count > 0 ? b.count : "0"}
              </span>
              <div
                className="w-full rounded-t-sm transition-all duration-500"
                style={{ height: h, background: b.count > 0 ? color : "rgba(120,46,21,0.08)" }}
                title={`${b.hour}:00 · ${b.count} reserva${b.count === 1 ? "" : "s"}`}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex items-center gap-1.5 border-t pt-1.5" style={{ borderColor: "rgba(120,46,21,0.10)" }}>
        {buckets.map((b) => (
          <span key={b.hour} className="flex-1 text-center text-[10px]" style={{ color: "var(--muted)" }}>
            {b.hour}h
          </span>
        ))}
      </div>
    </div>
  );
}

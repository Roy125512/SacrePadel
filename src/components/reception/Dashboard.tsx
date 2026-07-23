"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  CalendarCheck2,
  Clock,
  Gauge,
  Minus,
  ReceiptText,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import type { ApiResponse, Booking } from "@/lib/reception/types";
import {
  addDaysYMD,
  buildDailySummary,
  computeAggregateStats,
  currencyMXN,
  daysInclusive,
  enrichBooking,
  origenLabel,
  tipoLabel,
  toYMDLocal,
} from "@/lib/reception/utils";
import { AreaTrendChart, DonutChart, HBarList, HourlyBarChart } from "@/components/reception/charts";
import { IconButton } from "@/components/reception/ui";

type Mode = "DAY" | "RANGE";

async function fetchBookings(start: string, end: string): Promise<Booking[]> {
  const r = await fetch(`/api/reception/bookings?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`, {
    cache: "no-store",
  });
  const text = await r.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!r.ok) throw new Error(body?.error ?? `Error ${r.status}`);
  const typed = (body ?? {}) as ApiResponse;
  return (typed.bookings ?? []).map(enrichBooking);
}

function shortDay(ymd: string) {
  const d = new Date(`${ymd}T00:00:00`);
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit" });
}

function DeltaBadge({ current, previous, compareLabel }: { current: number; previous: number; compareLabel: string }) {
  if (previous === 0 && current === 0) return null;

  if (previous === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: "#0f9d6e" }}>
        <TrendingUp className="h-3 w-3" /> Nuevo
      </span>
    );
  }

  const pct = ((current - previous) / previous) * 100;
  const rounded = Math.round(pct);

  if (Math.abs(rounded) < 1) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: "var(--muted)" }}>
        <Minus className="h-3 w-3" /> Igual que el {compareLabel}
      </span>
    );
  }

  const up = rounded > 0;
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-semibold"
      style={{ color: up ? "#0f9d6e" : "#b91c1c" }}
    >
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? "+" : ""}
      {rounded}% vs. {compareLabel}
    </span>
  );
}

function DashKpiCard(props: {
  icon: React.ElementType;
  title: string;
  value: string;
  current: number;
  previous: number;
  compareLabel: string;
}) {
  const Icon = props.icon;
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2">
        <span className="chip h-8 w-8">
          <Icon className="h-4 w-4" />
        </span>
        <div className="text-xs" style={{ color: "var(--muted)" }}>
          {props.title}
        </div>
      </div>
      <div className="mt-3 text-3xl font-semibold" style={{ color: "var(--foreground)" }}>
        {props.value}
      </div>
      <div className="mt-1.5">
        <DeltaBadge current={props.current} previous={props.previous} compareLabel={props.compareLabel} />
      </div>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <div className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
        {title}
      </div>
      {subtitle && (
        <div className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
          {subtitle}
        </div>
      )}
      <div className="mt-4">{children}</div>
    </div>
  );
}

export default function ReceptionDashboard() {
  const [mode, setMode] = useState<Mode>("RANGE");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Booking[]>([]);
  const [prevRows, setPrevRows] = useState<Booking[]>([]);
  const [range, setRange] = useState<{ start: string; end: string }>(() => {
    const end = toYMDLocal(new Date());
    const start = addDaysYMD(end, -29);
    return { start, end };
  });

  const [dateYMD, setDateYMD] = useState<string>(() => toYMDLocal(new Date()));
  const [rangeStartYMD, setRangeStartYMD] = useState<string>(() => addDaysYMD(toYMDLocal(new Date()), -29));
  const [rangeEndYMD, setRangeEndYMD] = useState<string>(() => toYMDLocal(new Date()));

  async function loadRange(start: string, end: string) {
    setLoading(true);
    setError(null);
    try {
      const spanDays = daysInclusive(start, end);
      const prevEnd = addDaysYMD(start, -1);
      const prevStart = addDaysYMD(prevEnd, -(spanDays - 1));

      const [current, previous] = await Promise.all([fetchBookings(start, end), fetchBookings(prevStart, prevEnd)]);

      setRange({ start, end });
      setRows(current);
      setPrevRows(previous);
    } catch (e: any) {
      setError(e?.message ?? "Error al cargar el dashboard");
      setRows([]);
      setPrevRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadDay(d: string) {
    setLoading(true);
    setError(null);
    try {
      const prevDay = addDaysYMD(d, -1);

      const [current, previous] = await Promise.all([fetchBookings(d, d), fetchBookings(prevDay, prevDay)]);

      setRange({ start: d, end: d });
      setRows(current);
      setPrevRows(previous);
    } catch (e: any) {
      setError(e?.message ?? "Error al cargar el dashboard");
      setRows([]);
      setPrevRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRange(rangeStartYMD, rangeEndYMD);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const compareLabel = mode === "DAY" ? "día anterior" : "periodo anterior";

  const days = daysInclusive(range.start, range.end);
  const stats = useMemo(() => computeAggregateStats(rows, days), [rows, days]);
  const prevStats = useMemo(() => computeAggregateStats(prevRows, days), [prevRows, days]);
  const daily = useMemo(() => buildDailySummary(rows, range.start, range.end), [rows, range]);

  const revenueTrend = useMemo(() => daily.map((d) => ({ label: shortDay(d.ymd), value: d.ingresos })), [daily]);
  const occupancyTrend = useMemo(
    () => daily.map((d) => ({ label: shortDay(d.ymd), value: Math.round(d.ocupacion) })),
    [daily]
  );

  const paymentDonut = useMemo(
    () => [
      { label: "Efectivo", value: stats.efectivo, color: "var(--brand)" },
      { label: "Tarjeta", value: stats.tarjeta, color: "var(--brand-highlight)" },
      { label: "Transferencia", value: stats.transfer, color: "var(--court-700)" },
      { label: "Mercado Pago", value: stats.mercadopago, color: "var(--brand-900)" },
    ],
    [stats]
  );

  const statusDonut = useMemo(() => {
    const count = (s: string) => rows.filter((b) => b.status === s).length;
    return [
      { label: "Completadas", value: count("COMPLETED"), color: "#0f9d6e" },
      { label: "Confirmadas", value: count("CONFIRMED"), color: "var(--brand)" },
      { label: "No asistió", value: count("NO_SHOW"), color: "#d97706" },
      { label: "Canceladas", value: count("CANCELLED"), color: "rgba(120,46,21,0.35)" },
      { label: "Apartadas", value: count("HOLD"), color: "rgba(120,46,21,0.16)" },
    ];
  }, [rows]);

  const canchaComparison = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of rows) {
      if (b.status !== "CONFIRMED" && b.status !== "COMPLETED") continue;
      const key = b.court_name ?? "—";
      map.set(key, (map.get(key) ?? 0) + (b.duration_hours ?? 0));
    }
    return Array.from(map.entries())
      .map(([label, value]) => ({ label, value, sublabel: "vendidas" }))
      .sort((a, b) => b.value - a.value);
  }, [rows]);

  const hourlyBuckets = useMemo(() => {
    const counts = new Map<number, number>();
    for (let h = 7; h <= 21; h++) counts.set(h, 0);
    for (const b of rows) {
      if (b.status === "CANCELLED") continue;
      const h = new Date(b.start_at).getHours();
      if (counts.has(h)) counts.set(h, (counts.get(h) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([hour, count]) => ({ hour, count }));
  }, [rows]);

  const topClientes = useMemo(() => {
    const map = new Map<string, { name: string; ingresos: number; visitas: number }>();
    for (const b of rows) {
      if (!b.customer_id) continue;
      const entry = map.get(b.customer_id) ?? { name: b.customer_name?.trim() || "Sin nombre", ingresos: 0, visitas: 0 };
      entry.visitas += 1;
      if (b.payment_status === "PAID") entry.ingresos += b.paid_amount ?? 0;
      map.set(b.customer_id, entry);
    }
    return Array.from(map.values())
      .sort((a, b) => b.ingresos - a.ingresos)
      .slice(0, 6)
      .map((c) => ({ label: c.name, value: c.ingresos, sublabel: `${c.visitas} visita${c.visitas === 1 ? "" : "s"}` }));
  }, [rows]);

  const tipoBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of rows) map.set(tipoLabel(b), (map.get(tipoLabel(b)) ?? 0) + 1);
    return Array.from(map.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [rows]);

  const origenBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of rows) {
      const key = origenLabel(b.source);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [rows]);

  return (
    <div className="space-y-4">
      {/* Header + filtros (mismos controles que la vista de Reservas) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-display text-2xl">
            <span className="font-light italic">Panorama</span> <span className="font-black">del negocio.</span>
          </div>
          <div className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
            {loading
              ? "Cargando…"
              : mode === "DAY"
              ? `${shortDay(range.start)} · comparado con el día anterior`
              : `Del ${shortDay(range.start)} al ${shortDay(range.end)} · comparado con los ${days} días anteriores`}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          {/* modo */}
          <div className="rounded-xl border bg-white/70 p-1 backdrop-blur" style={{ borderColor: "rgba(120,46,21,0.12)" }}>
            <div className="flex items-center gap-1">
              <button
                className={`rounded-md px-3 py-2 text-sm transition ${mode === "DAY" ? "bg-white" : ""}`}
                style={
                  mode === "DAY"
                    ? { border: "1px solid rgba(120,46,21,0.14)", color: "var(--foreground)" }
                    : { color: "rgba(30,27,24,0.70)" }
                }
                onClick={() => {
                  setMode("DAY");
                  loadDay(dateYMD);
                }}
              >
                Día
              </button>

              <button
                className={`rounded-md px-3 py-2 text-sm transition ${mode === "RANGE" ? "bg-white" : ""}`}
                style={
                  mode === "RANGE"
                    ? { border: "1px solid rgba(120,46,21,0.14)", color: "var(--foreground)" }
                    : { color: "rgba(30,27,24,0.70)" }
                }
                onClick={() => {
                  setMode("RANGE");
                  const norm =
                    rangeStartYMD <= rangeEndYMD
                      ? { start: rangeStartYMD, end: rangeEndYMD }
                      : { start: rangeEndYMD, end: rangeStartYMD };
                  setRangeStartYMD(norm.start);
                  setRangeEndYMD(norm.end);
                  loadRange(norm.start, norm.end);
                }}
              >
                Rango
              </button>
            </div>
          </div>

          {mode === "DAY" ? (
            <>
              <div>
                <label className="block text-xs" style={{ color: "rgba(30,27,24,0.65)" }}>
                  Fecha
                </label>
                <input
                  className="input w-[170px]"
                  type="date"
                  value={dateYMD}
                  onChange={(e) => setDateYMD(e.target.value)}
                />
              </div>

              <IconButton
                text="Ayer"
                onClick={() => {
                  const v = addDaysYMD(dateYMD, -1);
                  setDateYMD(v);
                  loadDay(v);
                }}
              />
              <IconButton
                text="Hoy"
                onClick={() => {
                  const v = toYMDLocal(new Date());
                  setDateYMD(v);
                  loadDay(v);
                }}
              />
              <IconButton
                text="Mañana"
                onClick={() => {
                  const v = addDaysYMD(dateYMD, 1);
                  setDateYMD(v);
                  loadDay(v);
                }}
              />
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs" style={{ color: "rgba(30,27,24,0.65)" }}>
                  Inicio
                </label>
                <input
                  className="input w-[170px]"
                  type="date"
                  value={rangeStartYMD}
                  onChange={(e) => setRangeStartYMD(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs" style={{ color: "rgba(30,27,24,0.65)" }}>
                  Fin
                </label>
                <input
                  className="input w-[170px]"
                  type="date"
                  value={rangeEndYMD}
                  onChange={(e) => setRangeEndYMD(e.target.value)}
                />
              </div>

              <IconButton
                text="7 días"
                onClick={() => {
                  const end = toYMDLocal(new Date());
                  const start = addDaysYMD(end, -6);
                  setRangeStartYMD(start);
                  setRangeEndYMD(end);
                  loadRange(start, end);
                }}
              />
              <IconButton
                text="30 días"
                onClick={() => {
                  const end = toYMDLocal(new Date());
                  const start = addDaysYMD(end, -29);
                  setRangeStartYMD(start);
                  setRangeEndYMD(end);
                  loadRange(start, end);
                }}
              />
              <IconButton
                text="90 días"
                onClick={() => {
                  const end = toYMDLocal(new Date());
                  const start = addDaysYMD(end, -89);
                  setRangeStartYMD(start);
                  setRangeEndYMD(end);
                  loadRange(start, end);
                }}
              />
            </>
          )}

          <button
            className="btn-primary"
            disabled={loading}
            onClick={() => {
              if (mode === "DAY") {
                loadDay(dateYMD);
              } else {
                const norm =
                  rangeStartYMD <= rangeEndYMD
                    ? { start: rangeStartYMD, end: rangeEndYMD }
                    : { start: rangeEndYMD, end: rangeStartYMD };
                setRangeStartYMD(norm.start);
                setRangeEndYMD(norm.end);
                loadRange(norm.start, norm.end);
              }
            }}
          >
            Actualizar
          </button>
        </div>
      </div>

      {error && (
        <div
          className="rounded-md border px-3 py-2 text-sm"
          style={{ borderColor: "rgba(239,68,68,0.25)", background: "rgba(239,68,68,0.08)", color: "rgb(153,27,27)" }}
        >
          {error}
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <DashKpiCard
          icon={Banknote}
          title={mode === "DAY" ? "Ingresos del día" : "Ingresos del periodo"}
          value={currencyMXN(stats.ingresos)}
          current={stats.ingresos}
          previous={prevStats.ingresos}
          compareLabel={compareLabel}
        />
        <DashKpiCard
          icon={CalendarCheck2}
          title="Reservas totales"
          value={String(stats.totalReservas)}
          current={stats.totalReservas}
          previous={prevStats.totalReservas}
          compareLabel={compareLabel}
        />
        <DashKpiCard
          icon={Gauge}
          title="Ocupación promedio"
          value={`${Math.round(stats.ocupacion)}%`}
          current={stats.ocupacion}
          previous={prevStats.ocupacion}
          compareLabel={compareLabel}
        />
        <DashKpiCard
          icon={Clock}
          title="Tarifa promedio / h"
          value={`${currencyMXN(stats.tarifaPromedio)}`}
          current={stats.tarifaPromedio}
          previous={prevStats.tarifaPromedio}
          compareLabel={compareLabel}
        />
        <DashKpiCard
          icon={ReceiptText}
          title="Pendiente por cobrar"
          value={currencyMXN(stats.pendiente)}
          current={stats.pendiente}
          previous={prevStats.pendiente}
          compareLabel={compareLabel}
        />
      </div>

      {/* Trend charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="Ingresos por día" subtitle="Monto pagado, por fecha de la reserva">
          <AreaTrendChart data={revenueTrend} color="var(--brand)" formatValue={(v) => currencyMXN(v)} />
        </Section>
        <Section title="Ocupación por día" subtitle="% de horas vendidas sobre horas disponibles">
          <AreaTrendChart data={occupancyTrend} color="var(--court-700)" formatValue={(v) => `${v}%`} />
        </Section>
      </div>

      {/* Donuts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="Métodos de pago" subtitle="Sobre lo cobrado en el periodo">
          <DonutChart segments={paymentDonut} formatValue={(v) => currencyMXN(v)} centerLabel="Cobrado" />
        </Section>
        <Section title="Estatus de reservas" subtitle="Todas las reservas del periodo">
          <DonutChart segments={statusDonut} formatValue={(v) => String(Math.round(v))} centerLabel="Reservas" />
        </Section>
      </div>

      {/* Cancha comparison + peak hours */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="Comparativa de canchas" subtitle="Horas vendidas (confirmado / completado)">
          <HBarList items={canchaComparison} formatValue={(v) => `${(Math.round(v * 10) / 10).toFixed(1)} h`} />
        </Section>
        <Section title="Horas pico" subtitle="Reservas por hora de inicio">
          <HourlyBarChart buckets={hourlyBuckets} />
        </Section>
      </div>

      {/* Top clients + tipo/origen */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title="Top clientes del periodo" subtitle="Por monto pagado">
          <HBarList items={topClientes} formatValue={(v) => currencyMXN(v)} color="var(--brand-highlight)" />
        </Section>

        <div className="grid grid-cols-1 gap-4">
          <Section title="Tipo de reserva">
            <HBarList items={tipoBreakdown} color="var(--court-700)" />
          </Section>
          <Section title="Origen">
            <HBarList items={origenBreakdown} color="var(--brand)" />
          </Section>
        </div>
      </div>
    </div>
  );
}

"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

import type {
  ApiResponse,
  Booking,
  BookingStatus,
  DateMode,
  FiltersState,
  FilterKey,
  PaymentMethod,
  PaymentStatus,
} from "@/lib/reception/types";

import {
  DAY_RATE,
  NIGHT_RATE,
  NIGHT_START_HOUR,
  NIGHT_END_HOUR,
  TARIFF_PER_HOUR,
} from "@/lib/reception/pricing";

import {
  addDaysYMD,
  asistenciaLabel,
  buildDailySummary,
  canCancelBooking,
  canCharge,
  canEditCustomer,
  canMarkAttendance,
  computeAggregateStats,
  currencyMXN,
  daysInclusive,
  DEFAULT_COURTS,
  enrichBooking,
  formatDateES,
  formatDateMX,
  formatRangeES,
  hoursBetween,
  isAttendanceFinal,
  isPaid,
  normalizeRange,
  origenLabel,
  parseISOToLocalTime,
  parseISOToLocalTime24,
  statusLabelES,
  tipoLabel,
  toYMDLocal,
} from "@/lib/reception/utils";

import { useDebounce } from "@/lib/reception/hooks";
import { IconButton, KpiCard, Menu, MiniStat, Pill } from "@/components/reception/ui";
import ReceptionDashboard from "@/components/reception/Dashboard";

/* ===================== PÁGINA ===================== */

export default function ReceptionPage() {
  const [view, setView] = useState<"ops" | "dashboard">("ops");
  const [dateMode, setDateMode] = useState<DateMode>("DAY");
  const [dateYMD, setDateYMD] = useState<string>(() => toYMDLocal(new Date()));
  const [rangeStartYMD, setRangeStartYMD] = useState<string>(() => toYMDLocal(new Date()));
  const [rangeEndYMD, setRangeEndYMD] = useState<string>(() => toYMDLocal(new Date()));

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rows, setRows] = useState<Booking[]>([]);
  const [exporting, setExporting] = useState(false);


  const [filters, setFilters] = useState<FiltersState>(() => ({
    fecha: new Set(),
    cancha: new Set(),
    horario: new Set(),
    tipo: new Set(),
    estatus: new Set(),
    pago: new Set(),
    monto: new Set(),
    origen: new Set(),
    cliente: new Set(),
    asistencia: new Set(),
  }));


  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 250);

  const [openMenu, setOpenMenu] = useState<FilterKey | null>(null);
  const anchorRefs = useRef<Record<FilterKey, HTMLButtonElement | null>>({
    fecha: null,
    cancha: null,
    horario: null,
    tipo: null,
    estatus: null,
    pago: null,
    monto: null,
    origen: null,
    cliente: null,
    asistencia: null,
  });

  // Sticky (solo en escritorio, md+): medir alturas para apilar KPIs, corte de
  // caja, barra de búsqueda y acciones (exportar/limpiar), uno debajo del
  // otro. La tabla también se ancla justo debajo de esa pila (si no, al
  // seguir haciendo scroll de la página, su borde normal terminaría
  // deslizándose POR DEBAJO de las barras ancladas y su thead quedaría
  // tapado) — con eso anclado, el scroll extra pasa a ser interno a la
  // tabla (max-height + overflow-y-auto), donde el thead sí sticky
  // correctamente. En móvil nada de esto se ancla — demasiado poco
  // espacio vertical, ver feedback del usuario.
  const kpiStickyRef = useRef<HTMLDivElement | null>(null);
  const toolsStickyRef = useRef<HTMLDivElement | null>(null);
  const [toolsStickyTop, setToolsStickyTop] = useState(0);
  const actionsStickyRef = useRef<HTMLDivElement | null>(null);
  const [actionsTop, setActionsTop] = useState(0);
  const [tableTop, setTableTop] = useState(0);
  const cashoutStickyRef = useRef<HTMLDivElement | null>(null);
  const [cashoutTop, setCashoutTop] = useState(0);
    // Scroll sync (para que el header y el body se muevan juntos en horizontal)
  const headScrollRef = useRef<HTMLDivElement | null>(null);
  const bodyScrollRef = useRef<HTMLDivElement | null>(null);
  const syncingScrollRef = useRef(false);





  const [chargeOpen, setChargeOpen] = useState(false);
  const [chargeBooking, setChargeBooking] = useState<Booking | null>(null);
  const [chargeMethod, setChargeMethod] = useState<PaymentMethod>("CASH");
  const [chargeAmount, setChargeAmount] = useState<number>(0);
  const [chargeSaving, setChargeSaving] = useState(false);

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignBooking, setAssignBooking] = useState<Booking | null>(null);
  const [assignName, setAssignName] = useState("");
  const [assignPhone, setAssignPhone] = useState("");
  const [assignSaving, setAssignSaving] = useState(false);

  type PlayerApiResponse = {
    customer: {
      id: string;
      full_name: string | null;
      phone_e164: string | null;
      email: string | null;
      notes: string | null;
      birthday: string | null;
      player_notes: string | null;
      sex: string | null;
      division: string | null;
      is_active: boolean | null;
      created_at: string | null;
    };
    stats: {
      total_visits: number;
      total_paid: number;
      last_visit_at: string | null;
    };
    recent_bookings: Array<{
      id: string;
      start_at: string;
      end_at: string;
      status: string;
      payment_status: string;
      paid_amount: number;
      expected_amount: number;
      paid_at: string | null;
      payment_method: string | null;
      court_name: string;
      source: string | null;
      kind: string | null;
    }>;
    pagination?: {
      limit: number;
      offset: number;
      total: number;
      has_more: boolean;
    };
    error?: string;
  };

  const [playerOpen, setPlayerOpen] = useState(false);
  const [playerLoading, setPlayerLoading] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [playerData, setPlayerData] = useState<PlayerApiResponse | null>(null);

  const [receptionNotes, setReceptionNotes] = useState("");
const [notesSaving, setNotesSaving] = useState(false);
const [notesOk, setNotesOk] = useState<string | null>(null);
const [activeSaving, setActiveSaving] = useState(false);

function statusES(s: string) {
  const v = String(s || "").toUpperCase();
  if (v === "HOLD") return "Apartada";
  if (v === "CONFIRMED") return "Confirmada";
  if (v === "COMPLETED") return "Completada";
  if (v === "CANCELLED") return "Cancelada";
  if (v === "NO_SHOW") return "No asistió";
  return s; // fallback por si hay nuevos estados
}


  async function refreshData(next?: { mode: DateMode; date?: string; start?: string; end?: string }) {
    setLoading(true);
    setError(null);

    try {
      const mode = next?.mode ?? dateMode;
      const date = next?.date ?? dateYMD;
      const start = next?.start ?? rangeStartYMD;
      const end = next?.end ?? rangeEndYMD;

      const url =
        mode === "RANGE"
          ? (() => {
              const norm = start <= end ? { start, end } : { start: end, end: start };
              return `/api/reception/bookings?start=${encodeURIComponent(
                norm.start
              )}&end=${encodeURIComponent(norm.end)}`;
            })()
          : `/api/reception/bookings?date=${encodeURIComponent(date)}`;

      const r = await fetch(url, { cache: "no-store" });

      // 👇 evita “Unexpected end of JSON input”
      const text = await r.text();
      let body: any = null;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = null;
      }

      if (!r.ok) {
        const msg =
          body?.error ??
          (text?.slice(0, 200) ? `Error ${r.status}: ${text.slice(0, 200)}` : `Error ${r.status}`);
        setError(msg);
        setRows([]);
        return;
      }

      const typed = (body ?? {}) as ApiResponse;
      const enriched = (typed.bookings ?? []).map(enrichBooking);

      setRows(enriched);
    } catch (e: any) {
      setError(e?.message ?? "Error desconocido");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  function refreshCurrent() {
    return refreshData({
      mode: dateMode,
      date: dateYMD,
      start: rangeStartYMD,
      end: rangeEndYMD,
    });
  }

  useEffect(() => {
    const calc = () => {
      const kpiH = kpiStickyRef.current?.offsetHeight ?? 0;
      const cashH = cashoutStickyRef.current?.offsetHeight ?? 0;
      const toolsH = toolsStickyRef.current?.offsetHeight ?? 0;
      const actionsH = actionsStickyRef.current?.offsetHeight ?? 0;

      setCashoutTop(kpiH);                        // cashout debajo de KPIs
      setToolsStickyTop(kpiH + cashH);            // barra de búsqueda debajo de cashout
      setActionsTop(kpiH + cashH + toolsH);       // exportar/limpiar debajo de la barra
      setTableTop(kpiH + cashH + toolsH + actionsH); // tabla anclada debajo de todo
    };

    

    const raf = requestAnimationFrame(calc);
    window.addEventListener("resize", calc);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", calc);
    };
  }, [dateMode, loading, rows.length]);



  useEffect(() => {
    refreshData({ mode: "DAY", date: dateYMD });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ===================== KPIs ===================== */

  const stats = useMemo(() => {
    const days =
      dateMode === "RANGE"
        ? daysInclusive(
            (rangeStartYMD <= rangeEndYMD ? rangeStartYMD : rangeEndYMD),
            (rangeStartYMD <= rangeEndYMD ? rangeEndYMD : rangeStartYMD)
          )
        : 1;

    return computeAggregateStats(rows, days);
  }, [rows, dateMode, rangeStartYMD, rangeEndYMD]);

  /* ===================== FILTROS ===================== */

  const filterOptions = useMemo(() => {
    const uniq = (arr: string[]) => Array.from(new Set(arr)).sort((a, b) => a.localeCompare(b));

    const cancha = uniq(rows.map((b) => b.court_name ?? "—"));
    const horario = uniq(rows.map((b) => `${parseISOToLocalTime(b.start_at)} – ${parseISOToLocalTime(b.end_at)}`));
    const tipo = uniq(rows.map((b) => tipoLabel(b)));
    const estatus = uniq(rows.map((b) => statusLabelES(b.status)));
    const pago = uniq(rows.map((b) => ((b.payment_status ?? "UNPAID") === "PAID" ? "Pagado" : "Pendiente")));
    const monto = uniq(rows.map((b) => currencyMXN(b.amount ?? 0)));
    const origen = uniq(rows.map((b) => origenLabel(b.source)));
    const cliente = uniq(rows.map((b) => (b.customer_name && b.customer_name.trim().length > 0 ? b.customer_name.trim() : "Sin asignar")));
    const asistencia = uniq(rows.map((b) => asistenciaLabel(b)));
    const fecha = uniq(rows.map((b) => formatDateMX(b.start_at)));

    return { fecha, cancha, horario, tipo, estatus, pago, monto, origen, cliente, asistencia };
  }, [rows]);

  
  const filteredRows = useMemo(() => {
    const pass = (key: FilterKey, value: string) => {
      const selected = filters[key];
      if (!selected || selected.size === 0) return true;
      return selected.has(value);
    };

    const searchNorm = debouncedSearch.trim().toLowerCase();

    return rows.filter((b) => {
      const vFecha = formatDateMX(b.start_at);
      const vCancha = b.court_name ?? "—";
      const vHorario = `${parseISOToLocalTime(b.start_at)} – ${parseISOToLocalTime(b.end_at)}`;
      const vTipo = tipoLabel(b);
      const vEstatus = statusLabelES(b.status);
      const vPago = (b.payment_status ?? "UNPAID") === "PAID" ? "Pagado" : "Pendiente";
      const vMonto = currencyMXN(b.amount ?? 0);
      const vOrigen = origenLabel(b.source);
      const vCliente = b.customer_name && b.customer_name.trim().length > 0 ? b.customer_name.trim() : "Sin asignar";
      const vAsistencia = asistenciaLabel(b);

      const matchesSearch =
        !searchNorm ||
        vCliente.toLowerCase().includes(searchNorm) ||
        (b.customer_phone ?? "").toLowerCase().includes(searchNorm) ||
        vCancha.toLowerCase().includes(searchNorm);

      return (
        matchesSearch &&
        pass("fecha", vFecha) &&
        pass("cancha", vCancha) &&
        pass("horario", vHorario) &&
        pass("tipo", vTipo) &&
        pass("estatus", vEstatus) &&
        pass("pago", vPago) &&
        pass("monto", vMonto) &&
        pass("origen", vOrigen) &&
        pass("cliente", vCliente) &&
        pass("asistencia", vAsistencia)
      );

    });
  }, [rows, filters, debouncedSearch]);

  const dailySummary = useMemo(() => {
    if (dateMode !== "RANGE") return [];
    return buildDailySummary(rows, rangeStartYMD, rangeEndYMD);
  }, [dateMode, rangeStartYMD, rangeEndYMD, rows]);

  function clearAllFilters() {
    setFilters({
      fecha: new Set(),
      cancha: new Set(),
      horario: new Set(),
      tipo: new Set(),
      estatus: new Set(),
      pago: new Set(),
      monto: new Set(),
      origen: new Set(),
      cliente: new Set(),
      asistencia: new Set(),
    });
    setSearch("");
  }

  function csvEscape(v: any) {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (/[\r\n",]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  async function exportCsv() {
    // Exporta la vista actual (respeta filtros + búsqueda)
    const bks = filteredRows;
    if (!bks || bks.length === 0) return;

    setExporting(true);
    setError(null);

    try {
      const lines: string[] = [];

      // ===== Reservas =====
      lines.push(
        [
          "Fecha",
          "Inicio",
          "Fin",
          "Cancha",
          "Tipo",
          "Estatus",
          "Pago",
          "Monto esperado",
          "Monto pagado",
          "Método",
          "Cliente",
          "Teléfono",
          "Origen",
          "Booking ID",
        ]
          .map(csvEscape)
          .join(",")
      );

      for (const b of bks) {
        const pago = (b.payment_status ?? "UNPAID") === "PAID" ? "Pagado" : "Pendiente";
        const paidAmount = (b.payment_status ?? "UNPAID") === "PAID" ? (b.paid_amount ?? "") : "";

        lines.push(
          [
            formatDateMX(b.start_at),
            parseISOToLocalTime24(b.start_at),
            parseISOToLocalTime24(b.end_at),
            b.court_name ?? "",
            tipoLabel(b),
            statusLabelES(b.status),
            pago,
            typeof b.amount === "number" ? b.amount : "",
            paidAmount,
            b.payment_method ?? "",
            b.customer_name ?? "",
            b.customer_phone ?? "",
            origenLabel(b.source),
            b.id,
          ]
            .map(csvEscape)
            .join(",")
        );
      }

      // ===== Resumen por día (solo rango) =====
      if (dateMode === "RANGE") {
        lines.push("", "");
        lines.push(["Resumen por día"].map(csvEscape).join(","));
        lines.push(
          [
            "Día",
            "Reservas",
            "Horas",
            "Tarifa prom.",
            "Ocupación",
            "Pagado",
            "Pendiente",
            "Canceladas",
            "No asistió",
            "Completadas",
          ]
            .map(csvEscape)
            .join(",")
        );

        for (const d of dailySummary) {
          lines.push(
            [
              formatDateES(d.ymd),
              d.reservas,
              Math.round(d.horasVendidas * 10) / 10,
              Math.round(d.tarifaPromedio * 100) / 100,
              Math.round(d.ocupacion),
              Math.round(d.ingresos * 100) / 100,
              Math.round(d.pendiente * 100) / 100,
              d.canceladas,
              d.noShow,
              d.completadas,
            ]
              .map(csvEscape)
              .join(",")
          );
        }
      }

      const periodLabel =
        dateMode === "DAY"
          ? dateYMD
          : `${(rangeStartYMD <= rangeEndYMD ? rangeStartYMD : rangeEndYMD)}_${(rangeStartYMD <= rangeEndYMD ? rangeEndYMD : rangeStartYMD)}`;

      const filename = `reception_${periodLabel}.csv`;

      // BOM para que Excel lea acentos correctamente
      const csv = "\ufeff" + lines.join("\r\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();

      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e?.message ?? "No se pudo exportar");
    } finally {
      setExporting(false);
    }
  }



  function toggleFilter(key: FilterKey, value: string) {
    setFilters((prev) => {
      const next = { ...prev };
      const set = new Set(next[key]);
      if (set.has(value)) set.delete(value);
      else set.add(value);
      next[key] = set;
      return next;
    });
  }



  /* ===================== ACCIONES ===================== */

  async function setBookingStatus(id: string, status: BookingStatus) {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/reception/set-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: id, status }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body?.error ?? "Error al actualizar status");
      await refreshCurrent();
    } catch (e: any) {
      setError(e?.message ?? "Error");
    } finally {
      setLoading(false);
    }
  }

  async function payBooking(b: Booking) {
    setChargeBooking(b);
    setChargeMethod("CASH");
    setChargeAmount(b.amount ?? 0);
    setChargeOpen(true);
  }

  async function confirmPay() {
    if (!chargeBooking) return;
    setChargeSaving(true);
    setError(null);

    try {
      const r = await fetch("/api/reception/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booking_id: chargeBooking.id,
          payment_method: chargeMethod,
          paid_amount: chargeAmount,
        }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body?.error ?? "Error al cobrar");
      setChargeOpen(false);
      setChargeBooking(null);
      await refreshCurrent();
    } catch (e: any) {
      setError(e?.message ?? "Error");
    } finally {
      setChargeSaving(false);
    }
  }

  function openAssign(b: Booking) {
    setAssignBooking(b);
    setAssignName(b.customer_name ?? "");
    setAssignPhone(b.customer_phone ?? "");
    setAssignOpen(true);
  }

  async function confirmAssign() {
    if (!assignBooking) return;
    setAssignSaving(true);
    setError(null);

    try {
      const r1 = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: assignName,
          phone_e164: assignPhone,
        }),
      });
      const body1 = await r1.json();
      if (!r1.ok) throw new Error(body1?.error ?? "Error al crear/obtener cliente");

      const customerId = body1?.customer?.id;
      if (!customerId) throw new Error("No se obtuvo customer.id");

      const r2 = await fetch("/api/reception/attach-customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booking_id: assignBooking.id,
          customer_id: customerId,
        }),
      });
      const body2 = await r2.json();
      if (!r2.ok) throw new Error(body2?.error ?? "Error al asignar cliente");

      setAssignOpen(false);
      setAssignBooking(null);
      await refreshCurrent();
    } catch (e: any) {
      setError(e?.message ?? "Error");
    } finally {
      setAssignSaving(false);
    }
  }

  async function openPlayerCard(customerId: string) {
    setPlayerOpen(true);
    setPlayerLoading(true);
    setPlayerError(null);
    setPlayerData(null);

    try {
      const r = await fetch(`/api/customers/${customerId}?limit=10&offset=0`, { cache: "no-store" });
      const body = (await r.json()) as PlayerApiResponse;

      if (!r.ok) {
        setPlayerError((body as any)?.error ?? `Error ${r.status}`);
        return;
      }

      setPlayerData(body);
      setReceptionNotes(body?.customer?.notes ?? "");
      setNotesOk(null);
    } catch (e: any) {
      setPlayerError(e?.message ?? "Error al cargar ficha");
    } finally {
      setPlayerLoading(false);
    }
  }

  function closePlayerCard() {
    setPlayerOpen(false);
    setPlayerError(null);
    setPlayerData(null);
  }

  async function saveReceptionNotes() {
    if (!playerData?.customer?.id) return;

    setNotesSaving(true);
    setNotesOk(null);
    setPlayerError(null);

    try {
      const r = await fetch(`/api/customers/${playerData.customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: receptionNotes }),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error ?? `Error ${r.status}`);

      // reflejar en pantalla sin recargar
      setPlayerData((prev) =>
        prev
          ? { ...prev, customer: { ...prev.customer, notes: j?.customer?.notes ?? receptionNotes } }
          : prev
      );

      setNotesOk("Notas guardadas");
    } catch (e: any) {
      setPlayerError(e?.message ?? "No se pudieron guardar las notas.");
    } finally {
      setNotesSaving(false);
    }
  }

  async function toggleCustomerActive() {
    if (!playerData?.customer?.id) return;

    const nextActive = playerData.customer.is_active === false;
    setActiveSaving(true);
    setPlayerError(null);

    try {
      const r = await fetch(`/api/customers/${playerData.customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: nextActive }),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error ?? `Error ${r.status}`);

      setPlayerData((prev) =>
        prev
          ? { ...prev, customer: { ...prev.customer, is_active: j?.customer?.is_active ?? nextActive } }
          : prev
      );
    } catch (e: any) {
      setPlayerError(e?.message ?? "No se pudo cambiar el estado del cliente.");
    } finally {
      setActiveSaving(false);
    }
  }


  /* ===================== RENDER ===================== */

  return (
    <div className="page page-gradient">
      <div className="mx-auto w-full max-w-[96vw] px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--brand)]">Sacré Pádel</p>
            <h1 className="font-display mt-1 text-4xl leading-[1.05] sm:text-5xl">
              <span className="font-light italic">Control</span> <span className="font-black">de recepción.</span>
            </h1>
            <div className="section-subtitle">Reservas, cobros y desempeño del club, en un solo lugar.</div>

            {/* Tabs */}
            <div className="mt-4 inline-flex items-center gap-1 rounded-xl border bg-white/70 p-1 backdrop-blur" style={{ borderColor: "rgba(120,46,21,0.12)" }}>
              <button
                className="rounded-md px-4 py-2 text-sm font-medium transition"
                style={
                  view === "ops"
                    ? { border: "1px solid rgba(120,46,21,0.14)", background: "#fff", color: "var(--foreground)" }
                    : { color: "rgba(30,27,24,0.70)" }
                }
                onClick={() => setView("ops")}
              >
                Reservas
              </button>
              <button
                className="rounded-md px-4 py-2 text-sm font-medium transition"
                style={
                  view === "dashboard"
                    ? { border: "1px solid rgba(120,46,21,0.14)", background: "#fff", color: "var(--foreground)" }
                    : { color: "rgba(30,27,24,0.70)" }
                }
                onClick={() => setView("dashboard")}
              >
                Dashboard
              </button>
            </div>
          </div>

          {/* Date controls */}
          {view === "ops" && (
          <div className="flex flex-wrap items-end gap-3">
            {/* modo */}
            <div className="rounded-xl border bg-white/70 p-1 backdrop-blur" style={{ borderColor: "rgba(120,46,21,0.12)" }}>
              <div className="flex items-center gap-1">
                <button
                  className={`rounded-md px-3 py-2 text-sm transition ${
                    dateMode === "DAY"
                      ? "bg-white"
                      : ""
                  }`}
                  style={
                    dateMode === "DAY"
                      ? { border: "1px solid rgba(120,46,21,0.14)", color: "var(--foreground)" }
                      : { color: "rgba(30,27,24,0.70)" }
                  }
                  onClick={() => {
                    setDateMode("DAY");
                    refreshData({ mode: "DAY", date: dateYMD });
                  }}
                >
                  Día
                </button>

                <button
                  className={`rounded-md px-3 py-2 text-sm transition ${
                    dateMode === "RANGE"
                      ? "bg-white"
                      : ""
                  }`}
                  style={
                    dateMode === "RANGE"
                      ? { border: "1px solid rgba(120,46,21,0.14)", color: "var(--foreground)" }
                      : { color: "rgba(30,27,24,0.70)" }
                  }
                  onClick={() => {
                    setDateMode("RANGE");
                    const norm = rangeStartYMD <= rangeEndYMD ? { start: rangeStartYMD, end: rangeEndYMD } : { start: rangeEndYMD, end: rangeStartYMD };
                    setRangeStartYMD(norm.start);
                    setRangeEndYMD(norm.end);
                    refreshData({ mode: "RANGE", start: norm.start, end: norm.end });
                  }}
                >
                  Rango
                </button>
              </div>
            </div>

            {dateMode === "DAY" ? (
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
                    refreshData({ mode: "DAY", date: v });
                  }}
                />
                <IconButton
                  text="Hoy"
                  onClick={() => {
                    const v = toYMDLocal(new Date());
                    setDateYMD(v);
                    refreshData({ mode: "DAY", date: v });
                  }}
                />
                <IconButton
                  text="Mañana"
                  onClick={() => {
                    const v = addDaysYMD(dateYMD, 1);
                    setDateYMD(v);
                    refreshData({ mode: "DAY", date: v });
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
                    refreshData({ mode: "RANGE", start, end });
                  }}
                />
                <IconButton
                  text="30 días"
                  onClick={() => {
                    const end = toYMDLocal(new Date());
                    const start = addDaysYMD(end, -29);
                    setRangeStartYMD(start);
                    setRangeEndYMD(end);
                    refreshData({ mode: "RANGE", start, end });
                  }}
                />
              </>
            )}

            <button
              className="btn-primary"
              onClick={() => {
                if (dateMode === "DAY") {
                  refreshData({ mode: "DAY", date: dateYMD });
                } else {
                  const norm = rangeStartYMD <= rangeEndYMD ? { start: rangeStartYMD, end: rangeEndYMD } : { start: rangeEndYMD, end: rangeStartYMD };
                  setRangeStartYMD(norm.start);
                  setRangeEndYMD(norm.end);
                  refreshData({ mode: "RANGE", start: norm.start, end: norm.end });
                }
              }}
            >
              Actualizar
            </button>
          </div>
          )}
        </div>

        {view === "dashboard" && <ReceptionDashboard />}

        {view === "ops" && (
        <>
        {/* ===== Sticky Resumen ===== */}
        <div
          ref={kpiStickyRef} className="md:sticky top-0 z-50 -mx-4 px-4 pt-4"
          style={{
            background: "linear-gradient(180deg, rgba(253,238,232,0.92), rgba(255,255,255,0.92))",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)", // opcional, pero ayuda en Safari
            borderBottom: "1px solid rgba(120,46,21,0.10)",
          }}
        >
          <div className="pb-4">
            {/* Status */}
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <div style={{ color: "rgba(30,27,24,0.75)" }}>
                Periodo:{" "}
                <span style={{ color: "var(--foreground)", fontWeight: 600 }}>
                  {dateMode === "DAY" ? formatDateES(dateYMD) : formatRangeES(rangeStartYMD, rangeEndYMD)}
                </span>
              </div>

              {loading && <span style={{ color: "rgba(30,27,24,0.60)" }}>Cargando…</span>}

              {error && (
                <span
                  className="rounded-md border px-2 py-1"
                  style={{
                    borderColor: "rgba(239,68,68,0.25)",
                    background: "rgba(239,68,68,0.08)",
                    color: "rgb(153,27,27)",
                  }}
                >
                  {error}
                </span>
              )}
            </div>

            {/* KPI cards (bajé mt-8 a mt-4 para que no crezca tanto el sticky) */}
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-5">
              <KpiCard
                title={dateMode === "DAY" ? "Ingresos del día (pagado)" : "Ingresos del periodo (pagado)"}
                value={currencyMXN(stats.ingresos)}
                valueClass=""
              />
              <KpiCard
                title={dateMode === "DAY" ? "Pendiente por cobrar" : "Pendiente por cobrar (periodo)"}
                value={currencyMXN(stats.pendiente)}
              />
              <KpiCard
                title={dateMode === "DAY" ? "Horas vendidas (confirmado)" : "Horas vendidas (confirmado, periodo)"}
                value={`${Math.round(stats.horasVendidas * 10) / 10} h`}
              />
              <KpiCard
                title={dateMode === "DAY" ? "Ocupación (confirmado)" : "Ocupación (confirmado, periodo)"}
                value={`${Math.round(stats.ocupacion)}%`}
              />
              <KpiCard
                title={dateMode === "DAY" ? "Tarifa promedio (pagado / hora)" : "Tarifa promedio (pagado / hora, periodo)"}
                value={`${currencyMXN(stats.tarifaPromedio)} /h`}
              />
            </div>
          </div>
        </div>
        {/* ===== /Sticky Resumen ===== */}
        {/* Cashout (sticky) */}
          <div
            ref={cashoutStickyRef}
            className="md:sticky z-45 -mx-4 px-4 pb-4"
            style={{
              top: cashoutTop,
              background: "rgba(255,255,255,0.92)",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
              borderBottom: "1px solid rgba(120,46,21,0.10)",
            }}
          >
            <div className="card p-4">
              <div className="text-sm font-semibold" style={{ color: "rgba(30,27,24,0.90)" }}>
                Corte de caja (pagado)
              </div>
              <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-4">
                <MiniStat label="Efectivo" value={currencyMXN(stats.efectivo)} />
                <MiniStat label="Tarjeta" value={currencyMXN(stats.tarjeta)} />
                <MiniStat label="Transferencia" value={currencyMXN(stats.transfer)} />
                <MiniStat label="Mercado Pago" value={currencyMXN(stats.mercadopago)} />
              </div>
            </div>
          </div>


        {/* Resumen por día (RANGO) */}
        {dateMode === "RANGE" && (
          <div className="mt-4 card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-semibold" style={{ color: "rgba(30,27,24,0.90)" }}>
                Resumen por día
              </div>
              <div className="text-xs" style={{ color: "rgba(30,27,24,0.60)" }}>
                Tip: detecta días flojos para meter promo, liga o torneo.
              </div>
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[1040px] text-left text-sm">
                <thead
                  style={{
                    background: "linear-gradient(180deg, rgba(253,238,232,0.9), rgba(255,255,255,0.9))",
                    borderBottom: "1px solid rgba(120,46,21,0.10)",
                  }}
                >
                  <tr>
                    {["Día", "Reservas", "Horas", "Tarifa prom.", "Ocupación", "Pagado", "Pendiente", "Canceladas", "No asistió", "Asistió"].map((h) => (
                      <th key={h} className="px-3 py-2 text-xs font-semibold" style={{ color: "rgba(30,27,24,0.70)", letterSpacing: "0.06em" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dailySummary.map((d) => (
                    <tr key={d.ymd} style={{ borderTop: "1px solid rgba(120,46,21,0.08)" }}>
                      <td className="px-3 py-2" style={{ color: "rgba(30,27,24,0.92)", fontWeight: 600 }}>
                        {formatDateES(d.ymd)}
                      </td>
                      <td className="px-3 py-2">{d.reservas}</td>
                      <td className="px-3 py-2">{(Math.round(d.horasVendidas * 10) / 10).toFixed(1)} h</td>
                      <td className="px-3 py-2">{currencyMXN(d.tarifaPromedio)} /h</td>
                      <td className="px-3 py-2">{Math.round(d.ocupacion)}%</td>
                      <td className="px-3 py-2">{currencyMXN(d.ingresos)}</td>
                      <td className="px-3 py-2">{currencyMXN(d.pendiente)}</td>
                      <td className="px-3 py-2">{d.canceladas}</td>
                      <td className="px-3 py-2">{d.noShow}</td>
                      <td className="px-3 py-2">{d.completadas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        

        {/* Table header line */}
        <div
          ref={toolsStickyRef}
          className="mt-6 md:sticky z-40 -mx-4 px-4 py-3"

          style={{
            top: toolsStickyTop,
            background: "rgba(255,255,255,0.96)",
            backdropFilter: "blur(8px)",
            borderBottom: "1px solid rgba(120,46,21,0.10)",
          }}
        >
          <div
            className="flex flex-wrap items-center justify-between gap-3 text-sm"
            style={{ color: "rgba(30,27,24,0.75)" }}
          >
            <div>
              Reservas: <span style={{ color: "var(--foreground)", fontWeight: 600 }}>{filteredRows.length}</span> · Totales:{" "}
              <span style={{ color: "var(--foreground)", fontWeight: 600 }}>{stats.totalReservas}</span> · Pendientes de cobro:{" "}
              <span style={{ color: "var(--foreground)", fontWeight: 600 }}>{stats.pendientesCount}</span> · Tarifa/hora:{" "}
              <span style={{ color: "var(--foreground)", fontWeight: 600 }}>{currencyMXN(TARIFF_PER_HOUR)}</span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <input
                className="input w-[260px]"
                placeholder="Buscar cliente / teléfono / cancha…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                suppressHydrationWarning
              />

              {/* Si quieres dejar Exportar aquí fijo, ponlo aquí.
                  Si NO, déjalo abajo en el no-sticky (recomendado). */}
            </div>

          </div>
        </div>

        {/* Acciones (sticky en escritorio, debajo de la barra de búsqueda) */}
        <div
          ref={actionsStickyRef}
          className="md:sticky z-[35] -mx-4 flex justify-end gap-2 px-4 py-2"
          style={{
            top: actionsTop,
            background: "rgba(255,255,255,0.96)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            borderBottom: "1px solid rgba(120,46,21,0.10)",
          }}
        >
          <button
            className="btn-secondary"
            onClick={exportCsv}
            disabled={exporting || loading || filteredRows.length === 0}
          >
            {exporting ? "Exportando…" : "Exportar CSV"}
          </button>

          <button className="btn-secondary" onClick={clearAllFilters}>
            Limpiar filtros
          </button>
        </div>




        {/* Table.
            El thead sticky solo puede anclarse a SU contenedor de scroll más
            cercano — y overflow-x-auto obliga al navegador a computar
            overflow-y:auto en este div también (no hay forma de evitarlo con
            overflow-x != visible), así que ese contenedor YA es el que manda,
            aunque nunca tenga su propio scrollbar. Por eso le damos una
            altura máxima + scroll vertical propio en escritorio (así el
            thead sticky top:0 ancla dentro de su propio panel), Y ADEMÁS
            anclamos el panel completo justo debajo de las barras ya
            ancladas (KPIs/caja/búsqueda/acciones) — si no, al seguir
            haciendo scroll de la página, el panel (que no es sticky por sí
            mismo) terminaría deslizándose por debajo de esas barras y su
            thead quedaría tapado. En móvil nada de esto aplica (todo fluye
            normal, sin paneles con scroll interno). */}
        <div
          className="mt-4 min-h-[60vh] overflow-x-auto rounded-2xl border bg-white md:sticky md:max-h-[65vh] md:overflow-y-auto"
          style={{
            borderColor: "rgba(120,46,21,0.12)",
            top: tableTop,
          }}
        >
          <table className="min-w-[1200px] w-full text-left text-sm">
            <thead
              className="md:sticky"
              style={{
                // Opaque (sin transparencia) para que NO se vean las filas “a través”
                background: "linear-gradient(180deg, rgb(253,238,232), rgb(255,255,255))",
                borderBottom: "1px solid rgba(120,46,21,0.10)",

                top: 0,
                zIndex: 10,

                // opcional: separación visual bonita
                boxShadow: "0 6px 14px rgba(0,0,0,0.04)",
              }}
            >


              <tr>
                {[
                  { label: "Fecha", k: "fecha", opts: filterOptions.fecha, sel: filters.fecha },
                  { label: "Cancha", k: "cancha", opts: filterOptions.cancha, sel: filters.cancha },
                  { label: "Horario", k: "horario", opts: filterOptions.horario, sel: filters.horario },
                  { label: "Tipo", k: "tipo", opts: filterOptions.tipo, sel: filters.tipo },
                  { label: "Estatus", k: "estatus", opts: filterOptions.estatus, sel: filters.estatus },
                  { label: "Pago", k: "pago", opts: filterOptions.pago, sel: filters.pago },
                  { label: "Monto", k: "monto", opts: filterOptions.monto, sel: filters.monto },
                  { label: "Origen", k: "origen", opts: filterOptions.origen, sel: filters.origen },
                  { label: "Cliente", k: "cliente", opts: filterOptions.cliente, sel: filters.cliente },
                  { label: "Asistencia", k: "asistencia", opts: filterOptions.asistencia, sel: filters.asistencia },
                ].map((h) => (
                  <th
                    key={h.k}
                    className="px-4 py-2 text-xs font-semibold align-middle whitespace-nowrap"
                    style={{ color: "rgba(30,27,24,0.70)", letterSpacing: "0.06em" }}
                  >
                    <FilterHeader
                      label={h.label}
                      k={h.k as FilterKey}
                      openMenu={openMenu}
                      setOpenMenu={setOpenMenu}
                      anchorRefs={anchorRefs}
                      options={h.opts}
                      selected={h.sel}
                      onToggle={(v) => toggleFilter(h.k as FilterKey, v)}
                    />
                  </th>
                ))}

                <th
                  className="px-4 py-2 text-xs font-semibold align-middle whitespace-nowrap"
                  style={{ color: "rgba(30,27,24,0.70)", letterSpacing: "0.06em" }}
                >
                  Acciones
                </th>
              </tr>
            </thead>

            <tbody>
              {/* tu tbody se queda igual */}

              {filteredRows.length === 0 ? (
                <tr>
                  <td className="px-4 py-6" style={{ color: "rgba(30,27,24,0.60)" }} colSpan={11}>
                    No hay reservas para mostrar.
                  </td>
                </tr>
              ) : (
                filteredRows.map((b) => {
                  const horario = `${parseISOToLocalTime(b.start_at)} – ${parseISOToLocalTime(b.end_at)}`;
                  const pagoLabel = (b.payment_status ?? "UNPAID") === "PAID" ? "Pagado" : "Pendiente";
                  const clienteLabel = b.customer_name && b.customer_name.trim().length > 0 ? b.customer_name.trim() : "Sin asignar";

                  const statusTone =
                    b.status === "CONFIRMED"
                      ? "brand"
                      : b.status === "COMPLETED"
                      ? "ok"
                      : b.status === "NO_SHOW"
                      ? "warn"
                      : b.status === "CANCELLED"
                      ? "neutral"
                      : "neutral";

                  const payTone = pagoLabel === "Pagado" ? "ok" : "warn";

                  return (
                    <tr key={b.id} style={{ borderTop: "1px solid rgba(120,46,21,0.08)" }}>
                      <td className="px-4 py-4 whitespace-nowrap" style={{ color: "rgba(30,27,24,0.82)" }}>
                        {formatDateMX(b.start_at)}
                      </td>
                      <td className="px-4 py-4" style={{ color: "rgba(30,27,24,0.88)", fontWeight: 600 }}>
                        {b.court_name}
                      </td>
                      <td className="px-4 py-4" style={{ color: "rgba(30,27,24,0.85)" }}>
                        {horario}
                      </td>
                      <td className="px-4 py-4">{tipoLabel(b)}</td>

                      <td className="px-4 py-4">
                        <Pill text={statusLabelES(b.status)} tone={statusTone as any} />
                      </td>

                      <td className="px-4 py-4">
                        <Pill text={pagoLabel} tone={payTone as any} />
                      </td>

                      <td className="px-4 py-4">{currencyMXN(b.amount ?? 0)}</td>
                      <td className="px-4 py-4">{origenLabel(b.source)}</td>

                      <td className="px-4 py-4">
                        {clienteLabel === "Sin asignar" ? (
                          <button
                            className="btn-secondary"
                            disabled={!canEditCustomer(b) || loading}
                            onClick={() => {
                              if (canEditCustomer(b) && !loading) openAssign(b);
                            }}
                            style={{ opacity: !canEditCustomer(b) || loading ? 0.5 : 1 }}
                            title={!canEditCustomer(b) ? "Fila bloqueada" : "Asignar cliente"}
                          >
                            Asignar
                          </button>
                        ) : (
                          <div>
                            <button
                              type="button"
                              className="block text-left font-medium hover:underline"
                              style={{ color: "rgba(120,46,21,0.95)" }}
                              onClick={() => {
                                if (b.customer_id) openPlayerCard(b.customer_id);
                              }}
                              title="Ver ficha del jugador"
                            >
                              {clienteLabel}
                            </button>

                            {b.customer_phone && (
                              <div className="text-xs" style={{ color: "rgba(30,27,24,0.55)" }}>
                                {b.customer_phone}
                              </div>
                            )}

                            <div className="mt-2 flex items-center gap-2">
                              {/* ✅ Solo mostrar "Cambiar" si la fila no está bloqueada */}
                              {canEditCustomer(b) && (
                                <button className="btn-secondary" onClick={() => openAssign(b)} disabled={loading}>
                                  Cambiar
                                </button>
                              )}


                              {/* opcional: etiqueta visual cuando está bloqueada */}
                              {!canEditCustomer(b) && (
                                <span className="text-xs px-2 py-1 rounded-full" style={{ background: "rgba(180,106,74,0.12)", color: "rgba(120,46,21,0.85)" }}>
                                  Bloqueado
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-4">{asistenciaLabel(b)}</td>

                      <td className="px-4 py-4">
                        <div className="grid grid-cols-1 gap-2 min-w-[140px]">
                          <button
                            className="btn-primary w-full h-11"
                            disabled={!canCharge(b) || loading}
                            onClick={() => payBooking(b)}
                            style={{ opacity: !canCharge(b) || loading ? 0.5 : 1 }}
                          >
                            Cobrar
                          </button>

                          <button
                            className="btn-secondary w-full h-11"
                            disabled={!canCancelBooking(b) || loading}
                            onClick={() => {
                              if (canCancelBooking(b) && !loading)
                                setBookingStatus(b.id, "CANCELLED");
                            }}
                            style={{ opacity: !canCancelBooking(b) || loading ? 0.5 : 1 }}
                            title={isPaid(b) ? "No se puede cancelar una reserva pagada" : undefined}
                          >
                            Cancelar
                          </button>

                          <button
                            className="btn-secondary w-full h-11"
                            disabled={!canMarkAttendance(b) || loading}
                            onClick={() => {
                              if (canMarkAttendance(b) && !loading)
                                setBookingStatus(b.id, "NO_SHOW");
                            }}
                            style={{ opacity: !canMarkAttendance(b) || loading ? 0.5 : 1 }}
                            title={!isPaid(b) ? "Primero debes cobrar" : undefined}
                          >
                            No asistió
                          </button>

                          <button
                            className="btn-secondary w-full h-11"
                            disabled={!canMarkAttendance(b) || loading}
                            onClick={() => {
                              if (canMarkAttendance(b) && !loading)
                                setBookingStatus(b.id, "COMPLETED");
                            }}
                            style={{ opacity: !canMarkAttendance(b) || loading ? 0.5 : 1 }}
                            title={!isPaid(b) ? "Primero debes cobrar" : undefined}
                          >
                            Asistió
                          </button>
                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        </>
        )}
      </div>

      {/* MODAL: COBRO */}
      {chargeOpen && chargeBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md card p-5">
            <div className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
              Cobrar
            </div>
            <div className="mt-1 text-sm" style={{ color: "rgba(30,27,24,0.60)" }}>
              {chargeBooking.court_name} · {parseISOToLocalTime(chargeBooking.start_at)} – {parseISOToLocalTime(chargeBooking.end_at)}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {([
                { key: "CASH", label: "Efectivo" },
                { key: "CARD", label: "Tarjeta" },
                { key: "TRANSFER", label: "Transfer" },
              ] as Array<{ key: PaymentMethod; label: string }>).map((m) => {
                const active = chargeMethod === m.key;
                return (
                  <button
                    key={m.key}
                    className={active ? "btn-primary" : "btn-secondary"}
                    onClick={() => setChargeMethod(m.key)}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-4">
              <label className="block text-xs" style={{ color: "rgba(30,27,24,0.65)" }}>
                Monto
              </label>
              <input
                className="input"
                type="number"
                value={chargeAmount}
                onChange={(e) => setChargeAmount(Number(e.target.value))}
              />
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                className="btn-secondary"
                onClick={() => {
                  setChargeOpen(false);
                  setChargeBooking(null);
                }}
              >
                Cancelar
              </button>
              <button className="btn-primary" disabled={chargeSaving} onClick={confirmPay}>
                {chargeSaving ? "Guardando…" : "Confirmar cobro"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ASIGNAR CLIENTE */}
      {assignOpen && assignBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md card p-5">
            <div className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
              Asignar cliente
            </div>
            <div className="mt-1 text-sm" style={{ color: "rgba(30,27,24,0.60)" }}>
              {assignBooking.court_name} · {parseISOToLocalTime(assignBooking.start_at)} – {parseISOToLocalTime(assignBooking.end_at)}
            </div>

            <div className="mt-4">
              <label className="block text-xs" style={{ color: "rgba(30,27,24,0.65)" }}>
                Nombre
              </label>
              <input
                className="input"
                value={assignName}
                onChange={(e) => setAssignName(e.target.value)}
                placeholder="Nombre completo"
              />
            </div>

            <div className="mt-3">
              <label className="block text-xs" style={{ color: "rgba(30,27,24,0.65)" }}>
                Teléfono
              </label>
              <input
                className="input"
                value={assignPhone}
                onChange={(e) => setAssignPhone(e.target.value)}
                placeholder="+52..."
              />
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                className="btn-secondary"
                onClick={() => {
                  setAssignOpen(false);
                  setAssignBooking(null);
                }}
              >
                Cancelar
              </button>
              <button className="btn-primary" disabled={assignSaving} onClick={confirmAssign}>
                {assignSaving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: FICHA JUGADOR */}
      {playerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-2xl card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
                  Ficha de jugador
                </div>
                <div className="text-xs" style={{ color: "rgba(30,27,24,0.60)" }}>
                  Información y últimas reservas
                </div>
              </div>

              <button className="btn-secondary" onClick={() => closePlayerCard()}>
                Cerrar
              </button>
            </div>

            <div className="mt-4">
              {playerLoading && <div className="text-sm" style={{ color: "rgba(30,27,24,0.70)" }}>Cargando…</div>}

              {!playerLoading && playerError && (
                <div
                  className="rounded-md border p-3 text-sm"
                  style={{ borderColor: "rgba(239,68,68,0.25)", background: "rgba(239,68,68,0.08)", color: "rgb(153,27,27)" }}
                >
                  {playerError}
                </div>
              )}

              {!playerLoading && !playerError && playerData && (
                <div className="space-y-4">
                  <div className="rounded-xl border bg-white p-4" style={{ borderColor: "rgba(120,46,21,0.10)" }}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold" style={{ color: "var(--foreground)" }}>
                          {playerData.customer.full_name ?? "Sin nombre"}
                        </div>
                        <div className="mt-1 text-xs" style={{ color: "rgba(30,27,24,0.60)" }}>
                          {playerData.customer.email ?? "—"} • {playerData.customer.phone_e164 ?? "—"}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs" style={{ color: "rgba(30,27,24,0.60)" }}>
                          <span>
                            Cumpleaños: {playerData.customer.birthday ?? "—"} • Estado:{" "}
                            {playerData.customer.is_active === false ? "Inactivo" : "Activo"}
                          </span>
                          <button
                            type="button"
                            className="btn-secondary px-2 py-0.5 text-[11px]"
                            onClick={toggleCustomerActive}
                            disabled={activeSaving}
                          >
                            {activeSaving
                              ? "Guardando…"
                              : playerData.customer.is_active === false
                              ? "Reactivar"
                              : "Desactivar"}
                          </button>
                        </div>
                        <div className="mt-1 text-xs" style={{ color: "rgba(30,27,24,0.60)" }}>
                          Sexo: {playerData.customer.sex ?? "—"} • División: {playerData.customer.division ?? "—"}
                        </div>

                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-md border bg-white px-3 py-2" style={{ borderColor: "rgba(120,46,21,0.10)" }}>
                          <div className="text-[11px]" style={{ color: "rgba(30,27,24,0.60)" }}>Visitas</div>
                          <div className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{playerData.stats.total_visits ?? 0}</div>
                        </div>
                        <div className="rounded-md border bg-white px-3 py-2" style={{ borderColor: "rgba(120,46,21,0.10)" }}>
                          <div className="text-[11px]" style={{ color: "rgba(30,27,24,0.60)" }}>Total pagado</div>
                          <div className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>{currencyMXN(playerData.stats.total_paid ?? 0)}</div>
                        </div>
                        <div className="rounded-md border bg-white px-3 py-2" style={{ borderColor: "rgba(120,46,21,0.10)" }}>
                          <div className="text-[11px]" style={{ color: "rgba(30,27,24,0.60)" }}>Última visita</div>
                          <div className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                            {playerData.stats.last_visit_at ? new Date(playerData.stats.last_visit_at).toLocaleDateString("es-MX") : "—"}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div className="rounded-md border bg-white p-3" style={{ borderColor: "rgba(120,46,21,0.10)" }}>
                        <div className="text-xs font-semibold text-white/80">Notas de recepción</div>

                        <textarea
                          className="mt-2 w-full min-h-[90px] rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/90 placeholder:text-white/40"
                          placeholder="Escribe aquí notas internas (ej. nivel, preferencias, puntualidad, etc.)"
                          value={receptionNotes}
                          onChange={(e) => setReceptionNotes(e.target.value)}
                        />

                        <div className="mt-2 flex items-center justify-between gap-2">
                          <div className="text-xs text-emerald-300">{notesOk ?? ""}</div>

                          <button
                            type="button"
                            onClick={saveReceptionNotes}
                            disabled={notesSaving}
                            className="rounded-md bg-white px-3 py-1.5 text-xs text-black hover:opacity-90 disabled:opacity-60"
                          >
                            {notesSaving ? "Guardando…" : "Guardar notas"}
                          </button>
                        </div>

                      </div>
                      <div className="rounded-md border bg-white p-3" style={{ borderColor: "rgba(120,46,21,0.10)" }}>
                        <div className="text-xs font-semibold" style={{ color: "rgba(30,27,24,0.80)" }}>Nota jugador</div>
                        <div className="mt-1 whitespace-pre-wrap text-sm" style={{ color: "rgba(30,27,24,0.70)" }}>
                          {playerData.customer.player_notes?.trim() ? playerData.customer.player_notes : "—"}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border bg-white p-4" style={{ borderColor: "rgba(120,46,21,0.10)" }}>
                    <div className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                      Últimas reservas
                    </div>

                    <div className="mt-3 rounded-lg border bg-white" style={{ borderColor: "rgba(120,46,21,0.10)" }}>
                      <div className="max-h-[420px] overflow-auto">
                      <table className="w-full text-sm">
                        <thead
                          style={{
                            background: "linear-gradient(180deg, rgba(253,238,232,0.9), rgba(255,255,255,0.9))",
                            borderBottom: "1px solid rgba(120,46,21,0.10)",
                          }}
                        >
                          <tr>
                            {["Fecha", "Cancha", "Inicio", "Fin", "Estatus", "Pago", "Monto"].map((h) => (
                              <th key={h} className="px-3 py-2 text-xs font-semibold" style={{ color: "rgba(30,27,24,0.70)", letterSpacing: "0.06em" }}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(playerData.recent_bookings ?? []).length === 0 ? (
                            <tr>
                              <td className="px-3 py-3" style={{ color: "rgba(30,27,24,0.60)" }} colSpan={7}>
                                Sin reservas recientes
                              </td>
                            </tr>
                          ) : (
                            playerData.recent_bookings.map((rb) => (
                              <tr key={rb.id} style={{ borderTop: "1px solid rgba(120,46,21,0.08)" }}>
                                <td className="px-3 py-3 whitespace-nowrap">
                                  {new Date(rb.start_at).toLocaleDateString("es-MX")}
                                </td>
                                <td className="px-3 py-3">{rb.court_name}</td>
                                <td className="px-3 py-3">{parseISOToLocalTime(rb.start_at)}</td>
                                <td className="px-3 py-3">{parseISOToLocalTime(rb.end_at)}</td>
                                <td className="px-3 py-3">{statusES(String(rb.status))}</td>
                                <td className="px-3 py-3">{(rb.payment_status ?? "UNPAID") === "PAID" ? "Pagado" : "Pendiente"}</td>
                                <td className="px-3 py-3">{currencyMXN(rb.paid_amount ?? 0)}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===================== HEADER DE FILTRO ===================== */

function FilterHeader(props: {
  label: string;
  k: FilterKey;
  openMenu: FilterKey | null;
  setOpenMenu: (k: FilterKey | null) => void;
  anchorRefs: React.MutableRefObject<Record<FilterKey, HTMLButtonElement | null>>;
  options: string[];
  selected: Set<string>;
  onToggle: (value: string) => void;
}) {
  const isOpen = props.openMenu === props.k;
  const buttonRef = (el: HTMLButtonElement | null) => {
    props.anchorRefs.current[props.k] = el;
  };

  return (
    <div className="flex items-center gap-2 whitespace-nowrap">
      <span style={{ color: "rgba(30,27,24,0.75)" }}>{props.label}</span>

      <button
        ref={buttonRef}
        className="inline-flex h-6 w-6 items-center justify-center rounded-md border text-[10px] leading-none transition"
        style={{
          borderColor: isOpen ? "rgba(175,78,43,0.30)" : "rgba(120,46,21,0.14)",
          background: isOpen ? "rgba(253,238,232,1)" : "rgba(255,255,255,0.70)",
          color: "rgba(30,27,24,0.85)",
        }}
        onClick={() => props.setOpenMenu(isOpen ? null : props.k)}
        type="button"
      >
        ▼
      </button>

      <Menu
        open={isOpen}
        anchorRef={{
          current: props.anchorRefs.current[props.k] as unknown as HTMLElement,
        }}
        onClose={() => props.setOpenMenu(null)}
      >
        <div className="max-h-[280px] overflow-auto">
          {props.options.length === 0 ? (
            <div className="px-2 py-2 text-sm" style={{ color: "rgba(30,27,24,0.60)" }}>
              Sin opciones
            </div>
          ) : (
            props.options.map((opt) => {
              const checked = props.selected.has(opt);
              return (
                <label key={opt} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-[rgba(253,238,232,0.7)]">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => props.onToggle(opt)}
                    style={{ accentColor: "var(--brand)" } as any}
                  />
                  <span style={{ color: "rgba(30,27,24,0.85)" }}>{opt}</span>
                </label>
              );
            })
          )}
        </div>

        <div className="mt-2 border-t pt-2" style={{ borderColor: "rgba(120,46,21,0.10)" }}>
          <button
            className="btn-secondary w-full"
            onClick={() => {
              props.options.forEach((opt) => {
                if (props.selected.has(opt)) props.onToggle(opt);
              });
            }}
            type="button"
          >
            Limpiar {props.label}
          </button>
        </div>
      </Menu>
    </div>
  );
}

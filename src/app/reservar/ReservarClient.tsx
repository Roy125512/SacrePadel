"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { useRouter, useSearchParams } from "next/navigation";
import { BUSINESS_TZ_OFFSET } from "@/lib/config";
import { computeExpectedAmountMXN, priceLabelForRange } from "@/lib/pricing-shared";

// Checkout Pro redirects the browser away to Mercado Pago and back, so
// there's no embedded payment form/component to lazy-load here anymore
// (unlike the old Stripe Elements flow) — see startMercadoPagoPayment().
const MP_PENDING_KEY = "mp_pending_booking";

const TZ = "-06:00";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function toYMDLocal(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function parseISOToLocalTime(iso: string) {
  const dt = new Date(iso);
  return `${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;
}
function formatDateES(ymd: string) {
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}
function addMinutesIso(iso: string, minutes: number) {
  const m = iso.match(/([+-]\d{2}:\d{2})$/);
  const offset = m ? m[1] : BUSINESS_TZ_OFFSET;


  const [datePart, timeAndOffset] = iso.split("T");
  const timePart = timeAndOffset.slice(0, 8); // HH:mm:ss
  const [hh, mm, ss] = timePart.split(":").map((x) => Number(x));

  const total = hh * 60 + mm + minutes;

  const newH = Math.floor((total % (24 * 60) + 24 * 60) % (24 * 60) / 60);
  const newM = ((total % 60) + 60) % 60;

  return `${datePart}T${pad2(newH)}:${pad2(newM)}:${pad2(ss)}${offset}`;
}

// Pricing imported from @/lib/pricing-shared

type Slot = { start_at: string; end_at: string; available: boolean; can_start?: boolean };
type CourtAvailability = { court_id: string; court_name: string; slots: Slot[] };

type AvailabilityResponse = {
  date: string;
  timezone_offset: string;
  step_minutes: number;
  open_hour: number;
  close_hour: number;
  availability: CourtAvailability[];
};

type CustomerSuggestion = {
  id: string;
  full_name: string | null;
  phone_e164: string;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function ReservarClient() {
    // useSearchParams (bajo Suspense porque el page lo envuelve)
    const sp = useSearchParams();
    const router = useRouter();
    const isGuest = sp.get("mode") === "guest";

    const [dateYMD, setDateYMD] = useState(() => toYMDLocal(new Date()));
    const [dateDraft, setDateDraft] = useState(() => toYMDLocal(new Date()));
    const [isDateEditing, setIsDateEditing] = useState(false);

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    const [data, setData] = useState<AvailabilityResponse | null>(null);

    const [selected, setSelected] = useState<{
        court_id: string;
        court_name: string;
        start_at: string;
    } | null>(null);

    const [modalOpen, setModalOpen] = useState(false);

    const durations = useMemo(() => [60, 90, 120, 150, 180], []);
    const [durationMin, setDurationMin] = useState<number>(60);


    const [fullName, setFullName] = useState("");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");
    const [toleranceOpen, setToleranceOpen] = useState(false);
    const [emailInfo, setEmailInfo] = useState<{ sent: boolean; to: string | null; error: string | null } | null>(null);



    const [holdId, setHoldId] = useState<string | null>(null);

    // Payment state. "stripe" no longer exists as an in-page sub-mode:
    // Checkout Pro navigates the browser away immediately, so there's
    // nothing to render in between "choose" and coming back confirmed.
    type PaymentMode = "choose" | "reception";
    const [paymentMode, setPaymentMode] = useState<PaymentMode>("choose");
    const [mpLoading, setMpLoading] = useState(false);
    const [mpError, setMpError] = useState<string | null>(null);

    useEffect(() => {
        if (isGuest) return;
        (async () => {
        const { data } = await supabaseBrowser.auth.getSession();
        if (!data.session?.user) router.replace("/inicio");
        })();
    }, [isGuest, router]);

    // Return trip from Mercado Pago's Checkout Pro. It's a full page
    // redirect, so React state (holdId, fullName, phone...) from before the
    // redirect is gone — the confirmation details we need were stashed in
    // sessionStorage right before navigating away (see
    // startMercadoPagoPayment). Runs once on mount; harmless no-op for any
    // visit that isn't a Mercado Pago return (no "status" query param).
    useEffect(() => {
        const status = sp.get("status") ?? sp.get("collection_status");
        if (!status) return;

        const paymentId = sp.get("payment_id") ?? sp.get("collection_id");
        const externalRef = sp.get("external_reference");

        // Strip the query params immediately so a page refresh doesn't
        // re-trigger this.
        router.replace("/reservar", { scroll: false });

        let pending: { booking_id: string; full_name: string; phone: string; email?: string } | null = null;
        try {
        const raw = sessionStorage.getItem(MP_PENDING_KEY);
        pending = raw ? JSON.parse(raw) : null;
        } catch {}

        if (status !== "approved") {
        sessionStorage.removeItem(MP_PENDING_KEY);
        if (status === "pending" || status === "in_process") {
            setError("Tu pago quedó pendiente de aprobación. Te confirmaremos en cuanto se acredite.");
        } else {
            setError("El pago no se completó. Puedes intentar de nuevo.");
        }
        return;
        }

        if (!externalRef || !paymentId || !pending || pending.booking_id !== externalRef) {
        setError(
            "Tu pago fue aprobado, pero no pudimos completar la reserva automáticamente. Escríbenos con tu comprobante de pago y lo resolvemos."
        );
        return;
        }

        void finishMercadoPagoReturn(externalRef, paymentId, pending);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function finishMercadoPagoReturn(
        bookingId: string,
        mpPaymentId: string,
        pending: { full_name: string; phone: string; email?: string }
    ) {
        setSaving(true);
        setError(null);

        try {
        const r = await fetch("/api/web/confirm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
            booking_id: bookingId,
            full_name: pending.full_name,
            phone: pending.phone,
            email: pending.email || undefined,
            payment_method: "MERCADOPAGO",
            mp_payment_id: mpPaymentId,
            }),
        });

        const json = await r.json().catch(() => ({}));
        if (!r.ok) {
            setError(json?.error ?? `Error ${r.status}`);
            return;
        }

        sessionStorage.removeItem(MP_PENDING_KEY);
        setEmailInfo({
            sent: !!json?.email_sent,
            to: (json?.email_to ?? null) as any,
            error: (json?.email_error ?? null) as any,
        });
        setToleranceOpen(true);
        setSuccessMsg("Reserva confirmada y pagada en línea.");
        await loadAvailability(dateYMD);
        } finally {
        setSaving(false);
        }
    }

    async function loadAvailability(nextDate = dateYMD, opts?: { silent?: boolean }) {
        const silent = !!opts?.silent;

        if (!silent) {
        setLoading(true);
        setError(null);
        setSuccessMsg(null);
        }

        try {
        const r = await fetch(`/api/web/availability?date=${encodeURIComponent(nextDate)}`, {
            cache: "no-store",
        });
        const json = await r.json().catch(() => ({}));
        if (!r.ok) {
            if (!silent) setError(json?.error ?? `Error ${r.status}`);
            return;
        }
        setData(json as AvailabilityResponse);
        } catch (e: any) {
        if (!silent) setError(e?.message ?? "Error desconocido");
        } finally {
        if (!silent) setLoading(false);
        }
    }

    useEffect(() => {
        loadAvailability(dateYMD);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const t = setInterval(() => {
        if (isDateEditing) return;
        if (!saving && !modalOpen) loadAvailability(dateYMD, { silent: true });
        }, 5000);
        return () => clearInterval(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dateYMD, saving, modalOpen, isDateEditing]);

    function getCourtSlots(court_id: string) {
        const c = (data?.availability ?? []).find((x) => x.court_id === court_id);
        return c?.slots ?? [];
    }

    function maxConsecutiveFreeBlocks(court_id: string, start_at: string) {
        const slots = getCourtSlots(court_id);
        const idx = slots.findIndex((s) => s.start_at === start_at);
        if (idx < 0) return 0;

        let k = 0;
        for (let i = idx; i < slots.length; i++) {
        if (!slots[i].available) break;
        k++;
        }
        return k;
    }

    const allowedDurations = useMemo(() => {
        if (!selected || !data) return durations;
        const blocks = maxConsecutiveFreeBlocks(selected.court_id, selected.start_at);
        const maxMinutes = blocks * data.step_minutes;
        return durations.filter((d) => d <= maxMinutes);
    }, [selected, data, durations]);

    useEffect(() => {
        if (!selected) return;
        if (allowedDurations.length === 0) return;
        if (!allowedDurations.includes(durationMin)) {
        setDurationMin(allowedDurations[allowedDurations.length - 1]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [allowedDurations.length, selected]);

    async function pickSlot(c: CourtAvailability, s: Slot) {
        if (!s.available) return;
        if (s.can_start === false) return;


        setError(null);
        setSuccessMsg(null);

        setSelected({ court_id: c.court_id, court_name: c.court_name, start_at: s.start_at });

        const step = data?.step_minutes ?? 30;
        const blocks = maxConsecutiveFreeBlocks(c.court_id, s.start_at);
        const maxMinutes = blocks * step;

        if (maxMinutes < 60) {
        setError("No hay continuidad suficiente desde este inicio. Elige otro horario con al menos 60 minutos disponibles.");
        return;
        }

        const defaultDur = 60;
        setDurationMin(defaultDur);

        if (isGuest) {
        setFullName("");
        setPhone("");
        setEmail("");
        }

        // Reset payment state
        setPaymentMode("choose");
        setMpError(null);

        setModalOpen(true);


        if (!isGuest) {
        try {
            const { data: ses } = await supabaseBrowser.auth.getSession();
            const u = ses.session?.user;

            if (u) {
            setEmail(u.email ?? "");

            const { data: p, error: pErr } = await supabaseBrowser
                .from("profiles")
                .select("full_name, phone_e164")
                .eq("id", u.id)
                .maybeSingle();

            if (pErr) {
                console.warn("profiles select error:", pErr.message);
            }

            const fallbackName =
                (u.user_metadata?.full_name as string | undefined) ||
                (u.user_metadata?.name as string | undefined) ||
                "";

            setFullName(p?.full_name ?? fallbackName);
            setPhone(p?.phone_e164 ?? "");
            }
        } catch (e) {
            console.warn("Error cargando perfil en reservar:", e);
        }
        }


        try {
        const start_at = s.start_at;
        const end_at = addMinutesIso(start_at, defaultDur);

        const rHold = await fetch("/api/web/hold", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ court_id: c.court_id, start_at, end_at }),
        });

        const jHold = await rHold.json().catch(() => ({}));
        if (!rHold.ok) {
            setError(jHold?.error ?? `Error ${rHold.status}`);
            setModalOpen(false);
            setSelected(null);
            return;
        }

        setHoldId(String(jHold?.booking?.id ?? ""));
        } catch (e: any) {
        setError(e?.message ?? "No se pudo crear el HOLD");
        setModalOpen(false);
        setSelected(null);
        }
    }


    useEffect(() => {
        // Duration is locked once payment is in progress (see the disabled
        // select above) — don't let this effect silently extend/shrink a
        // HOLD whose Mercado Pago preference amount is already fixed.
        if (!modalOpen || !selected || !holdId || paymentMode !== "choose" || mpLoading) return;

        const controller = new AbortController();

        const t = setTimeout(async () => {
        const end_at = addMinutesIso(selected.start_at, durationMin);

        try {
            const r = await fetch("/api/web/update-hold", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ booking_id: holdId, end_at }),
            signal: controller.signal,
            });

            const j = await r.json().catch(() => ({}));
            if (!r.ok) {
            setError(j?.error ?? `Error ${r.status}`);
            if (durationMin !== 60) setDurationMin(60);
            }
        } catch (e: any) {
            if (e?.name === "AbortError") return;
            setError(e?.message ?? "No se pudo ajustar el HOLD");
        }
        }, 250);

        return () => {
        controller.abort();
        clearTimeout(t);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [durationMin, modalOpen, holdId, selected?.start_at]);


    async function cancelHoldAndClose() {
        setSaving(true);
        setError(null);

        try {
        if (holdId) {
            await fetch("/api/web/release-hold", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ booking_id: holdId }),
            });
        }
        } finally {
        setModalOpen(false);
        setSelected(null);
        setHoldId(null);
        setFullName("");
        setPhone("");
        setPaymentMode("choose");
        setMpError(null);
        setSaving(false);
        await loadAvailability(dateYMD);
        }
    }

    function validateForm(): { full_name: string; phone_input: string } | null {
        const full_name = fullName.trim();
        const phone_input = phone.trim();

        if (!full_name) { setError("Escribe tu nombre."); return null; }
        if (!phone_input) { setError("Escribe tu telefono."); return null; }
        if (allowedDurations.length === 0) {
        setError("No hay continuidad suficiente desde ese inicio. Elige otro horario.");
        return null;
        }
        return { full_name, phone_input };
    }

    async function confirmBooking(payMethod: "RECEPTION") {
        if (!selected) return;
        if (!holdId) return setError("No hay HOLD activo. Vuelve a seleccionar el horario.");

        const v = validateForm();
        if (!v) return;

        setSaving(true);
        setError(null);

        try {
        const r = await fetch("/api/web/confirm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
            booking_id: holdId,
            full_name: v.full_name,
            phone: v.phone_input,
            email: isGuest ? email.trim() : email.trim() || undefined,
            payment_method: payMethod,
            }),
        });

        const json = await r.json().catch(() => ({}));
        if (!r.ok) {
            setError(json?.error ?? `Error ${r.status}`);
            // Back to the payment-options view so the user isn't stranded
            // with no visible way to retry.
            setPaymentMode("choose");

            try {
            await fetch("/api/web/release-hold", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ booking_id: holdId }),
            });
            } catch {}

            return;
        }


        setModalOpen(false);
        setSelected(null);
        setHoldId(null);
        setFullName("");
        setPhone("");
        setPaymentMode("choose");

        setEmailInfo({
            sent: !!json?.email_sent,
            to: (json?.email_to ?? null) as any,
            error: (json?.email_error ?? null) as any,
        });
        setToleranceOpen(true);
        setSuccessMsg("Reserva confirmada. Tu pago se realiza en recepcion.");
        await loadAvailability(dateYMD);
        } finally {
        setSaving(false);
        }
    }

    async function startMercadoPagoPayment() {
        if (!holdId) return setError("No hay HOLD activo.");
        const v = validateForm();
        if (!v) return;

        setMpLoading(true);
        setMpError(null);
        setError(null);

        try {
        // Stashed here because Checkout Pro is a full-page redirect — this
        // component unmounts entirely and React state is gone by the time
        // the browser comes back. finishMercadoPagoReturn() reads this.
        sessionStorage.setItem(
            MP_PENDING_KEY,
            JSON.stringify({
            booking_id: holdId,
            full_name: v.full_name,
            phone: v.phone_input,
            email: isGuest ? email.trim() : email.trim() || undefined,
            })
        );

        const r = await fetch("/api/web/create-mp-preference", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ booking_id: holdId }),
        });

        const json = await r.json().catch(() => ({}));
        if (!r.ok) {
            setMpError(json?.error ?? `Error ${r.status}`);
            sessionStorage.removeItem(MP_PENDING_KEY);
            return;
        }

        window.location.href = json.init_point;
        } catch (e: any) {
        setMpError(e?.message ?? "Error al iniciar el pago.");
        sessionStorage.removeItem(MP_PENDING_KEY);
        } finally {
        setMpLoading(false);
        }
    }

    async function applyDateDraft(next: string) {
        setIsDateEditing(false);
        if (modalOpen) return;

        if (next !== dateYMD) {
        setDateYMD(next);
        await loadAvailability(next);
        }
    }

        const selectedEndAt = useMemo(() => {
        if (!selected) return null;
        return addMinutesIso(selected.start_at, durationMin);
        }, [selected, durationMin]);

        const priceInfo = useMemo(() => {
        if (!selected || !selectedEndAt) return null;
        const total = computeExpectedAmountMXN(selected.start_at, selectedEndAt);
        const label = priceLabelForRange(selected.start_at, selectedEndAt);
        return { total, label };
        }, [selected, selectedEndAt]);



    return (
        <div className="page page-gradient">
        <div className="mx-auto max-w-6xl px-6 py-10">

            {/* ===== HEADER ===== */}
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
                <span className="flex items-center gap-3 text-[0.7rem] font-semibold uppercase tracking-[0.32em] text-[var(--brand)]">
                <span aria-hidden className="h-px w-10 bg-[var(--brand)]" />
                Disponibilidad en vivo
                </span>
                <h1 className="font-display mt-4 text-4xl leading-[1.02] sm:text-5xl">
                <span className="font-light italic">Reserva</span>{" "}
                <span className="font-black">tu cancha.</span>
                {isGuest && (
                    <span className="ml-2 align-middle text-base font-normal not-italic" style={{ color: "var(--muted)" }}>
                    (Invitado)
                    </span>
                )}
                </h1>
                <p className="section-subtitle max-w-sm">Selecciona un horario disponible para tu cancha</p>

                {isGuest && (
                <div className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
                    Quieres que la proxima sea mas rapido?{" "}
                    <button
                    className="font-medium underline underline-offset-2 transition-colors hover:opacity-80"
                    style={{ color: "var(--brand)" }}
                    onClick={() => router.push("/perfil?next=/reservar")}
                    >
                    Crear cuenta
                    </button>
                </div>
                )}
            </div>

            <div className="flex flex-wrap items-end gap-3">
                <div>
                <label className="block text-[0.65rem] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--muted)" }}>
                    Fecha
                </label>
                <input
                    className="input w-[170px]"
                    type="date"
                    value={dateDraft}
                    onFocus={() => setIsDateEditing(true)}
                    onChange={(e) => setDateDraft(e.target.value)}
                    onKeyDown={(e) => {
                    if (e.key === "Enter") {
                        applyDateDraft(dateDraft);
                        (e.target as HTMLInputElement).blur();
                    }
                    if (e.key === "Escape") {
                        setDateDraft(dateYMD);
                        setIsDateEditing(false);
                        (e.target as HTMLInputElement).blur();
                    }
                    }}
                    onBlur={() => applyDateDraft(dateDraft)}
                />
                </div>

                <button
                className="btn-primary"
                onClick={() => {
                    if (dateDraft !== dateYMD) applyDateDraft(dateDraft);
                    else loadAvailability(dateYMD);
                }}
                disabled={loading || saving}
                >
                {loading ? "Cargando..." : "Ver disponibilidad"}
                </button>
            </div>
            </div>

            {/* ===== DATE INFO BAR ===== */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
            <span
                className="inline-flex items-center gap-2 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]"
                style={{
                background: "var(--brand-50)",
                borderLeft: "2px solid var(--brand)",
                color: "var(--brand-800)",
                }}
            >
                {formatDateES(dateYMD)}
            </span>
            <span className="text-xs" style={{ color: "var(--muted)" }}>
                Intervalos de 30 min &middot; Hora local
            </span>
            </div>

            {/* ===== ERROR / SUCCESS ALERTS ===== */}
            {error && (
            <div
                className="mt-4 animate-slide-down rounded-xl border px-4 py-3 text-sm"
                style={{
                borderColor: "rgba(220, 38, 38, 0.2)",
                background: "rgba(254, 242, 242, 1)",
                color: "rgb(153, 27, 27)",
                }}
            >
                {error}
            </div>
            )}

            {successMsg && (
            <div
                className="mt-4 animate-slide-down rounded-xl border px-4 py-3 text-sm"
                style={{
                borderColor: "rgba(16, 185, 129, 0.2)",
                background: "rgba(236, 253, 245, 1)",
                color: "rgb(6, 95, 70)",
                }}
            >
                {successMsg}
            </div>
            )}

            {/* ===== LOADING SKELETON ===== */}
            {loading && !data && (
            <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
                {[0, 1].map((i) => (
                <div key={i} className="card overflow-hidden p-0">
                    <div className="border-b px-5 py-3" style={{ borderColor: "rgba(175,78,43,0.08)" }}>
                    <div className="h-4 w-28 animate-pulse rounded" style={{ background: "var(--brand-50)" }} />
                    </div>
                    <div className="p-4">
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                        {Array.from({ length: 18 }).map((_, j) => (
                        <div key={j} className="h-9 animate-pulse rounded-lg" style={{ background: "var(--surface-2)" }} />
                        ))}
                    </div>
                    </div>
                </div>
                ))}
            </div>
            )}

            {/* ===== COURT GRID ===== */}
            <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
            {(data?.availability ?? []).map((c) => (
                <div key={c.court_id} className="overflow-hidden rounded-lg border bg-[var(--surface)] transition-colors duration-200 hover:border-[var(--brand-200)]" style={{ borderColor: "rgba(120,46,21,0.14)" }}>
                {/* Court header */}
                <div
                    className="flex items-center gap-3 border-b px-5 py-3.5"
                    style={{ borderColor: "rgba(120,46,21,0.10)" }}
                >
                    <span
                        aria-hidden
                        className="h-5 w-1"
                        style={{ background: "var(--brand)" }}
                    />
                    <span className="font-display text-lg font-semibold" style={{ color: "var(--foreground)" }}>
                        {c.court_name}
                    </span>
                </div>

                {/* Slots grid */}
                <div className="p-4">
                    <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                    {c.slots.map((s) => {
                    const isBooked = !s.available;
                    const canStart = s.can_start !== false;
                    const isStartDisabled = !canStart && !isBooked;

                    const isSelected =
                        !!selected &&
                        selected.court_id === c.court_id &&
                        selected.start_at === s.start_at;

                    return (
                        <button
                        key={`${c.court_id}-${s.start_at}`}
                        type="button"
                        onClick={() => pickSlot(c, s)}
                        disabled={isBooked || isStartDisabled || saving}
                        className={cx(
                            "rounded-lg border px-2 py-2.5 text-xs font-medium transition-all duration-150",
                            "focus:outline-none focus:ring-2",
                            isBooked
                            ? "cursor-not-allowed border-transparent bg-[var(--surface-2)] line-through opacity-40"
                            : isSelected
                            ? "border-[var(--brand-600)] text-white shadow-md ring-2 ring-[var(--brand-200)]"
                            : isStartDisabled
                            ? "cursor-not-allowed border-transparent bg-[var(--surface-2)] opacity-30"
                            : "border-[rgba(120,46,21,0.10)] bg-white hover:border-[var(--brand-200)] hover:bg-[var(--brand-50)] hover:shadow-sm active:scale-[0.97]"
                        )}
                        style={
                            isSelected
                            ? { background: "linear-gradient(135deg, var(--brand-highlight), var(--brand))" }
                            : undefined
                        }
                        title={`${parseISOToLocalTime(s.start_at)}\u2013${parseISOToLocalTime(s.end_at)} (30m)`}
                        >
                        {parseISOToLocalTime(s.start_at)}
                        </button>
                    );
                    })}
                    </div>
                </div>
                </div>
            ))}
            </div>

            {/* ===== FOOTER NOTE ===== */}
            <div className="mt-8 border-t pt-4 text-xs leading-relaxed" style={{ color: "var(--muted)", borderColor: "rgba(120,46,21,0.15)" }}>
            El calendario muestra horarios en <b>intervalos de 30 min</b>. La reserva minima es de{" "}
            <b>60 min</b>; la duracion se elige despues de seleccionar el horario.
            </div>
        </div>

        {/* ===== BOOKING MODAL ===== */}
        {modalOpen && selected && (
            <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto px-4 py-4 animate-fade-in"
            style={{ background: "rgba(30, 27, 24, 0.45)", backdropFilter: "blur(4px)" }}
            >
            <div className="w-full max-w-md my-auto animate-slide-up">
                <div className="overflow-hidden rounded-2xl bg-white shadow-2xl" style={{ border: "1px solid rgba(120, 46, 21, 0.10)" }}>

                {/* Modal header — deep-copper checkout band */}
                <div
                    className="px-6 py-5"
                    style={{
                    background: "var(--court)",
                    borderBottom: "1px solid rgba(120, 46, 21, 0.25)",
                    }}
                >
                    <span className="flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.28em]" style={{ color: "rgba(246, 240, 230, 0.72)" }}>
                    <span aria-hidden className="inline-block h-px w-7" style={{ background: "rgba(246, 240, 230, 0.6)" }} />
                    Confirmar reserva
                    </span>
                    <h2 className="font-display mt-2 text-2xl leading-tight" style={{ color: "#F6F0E6" }}>
                    <span className="font-light italic">{selected.court_name}</span>
                    </h2>
                    <div className="mt-1 text-sm" style={{ color: "rgba(246, 240, 230, 0.78)" }}>
                    {formatDateES(dateYMD)}
                    </div>

                    {selectedEndAt && (
                    <div className="mt-4 flex flex-wrap items-baseline gap-2">
                        <span className="font-display text-3xl font-black" style={{ color: "#F6F0E6" }}>
                        {parseISOToLocalTime(selected.start_at)}&ndash;{parseISOToLocalTime(selectedEndAt)}
                        </span>
                        <span className="badge-brand">{durationMin} min</span>
                    </div>
                    )}
                </div>

                {/* Modal body */}
                <div className="px-6 py-5 space-y-4">

                    {/* Duration */}
                    <div>
                    <label className="block text-[0.65rem] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--muted)" }}>
                        Duracion
                    </label>
                    <select
                        className="input w-full"
                        value={durationMin}
                        onChange={(e) => setDurationMin(Number(e.target.value))}
                        disabled={allowedDurations.length === 0 || paymentMode !== "choose" || mpLoading}
                    >
                        {allowedDurations.map((d) => (
                        <option key={d} value={d}>
                            {d} min
                        </option>
                        ))}
                    </select>
                    {allowedDurations.length === 0 && (
                        <div className="mt-1.5 text-xs" style={{ color: "rgb(153, 27, 27)" }}>
                        No hay continuidad suficiente. Elige otro horario.
                        </div>
                    )}
                    {(paymentMode !== "choose" || mpLoading) && (
                        <div className="mt-1.5 text-xs" style={{ color: "var(--muted)" }}>
                        La duracion queda fija una vez que inicias el pago.
                        </div>
                    )}
                    </div>

                    {/* Price card */}
                    {priceInfo && selectedEndAt && (
                    <div className="flex items-end justify-between gap-3 border-t pt-4" style={{ borderColor: "rgba(120,46,21,0.15)" }}>
                        <div>
                            <div className="text-[0.65rem] font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--muted)" }}>
                            Precio
                            </div>
                            <div className="mt-1 text-sm" style={{ color: "var(--brand-800)" }}>
                            {priceInfo.label}
                            </div>
                        </div>
                        <div className="flex items-baseline gap-1.5">
                            <span className="font-display text-4xl font-black leading-none" style={{ color: "var(--foreground)" }}>
                            ${priceInfo.total}
                            </span>
                            <span className="text-sm font-medium" style={{ color: "var(--muted)" }}>
                            MXN
                            </span>
                        </div>
                    </div>
                    )}

                    {/* Name */}
                    <div>
                    <label className="block text-[0.65rem] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--muted)" }}>
                        Nombre
                    </label>
                    <input
                        className="input disabled:opacity-60"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Tu nombre completo"
                        disabled={!isGuest}
                    />
                    {!isGuest && (
                        <div className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                        Tus datos vienen de tu perfil.
                        </div>
                    )}
                    </div>

                    {/* Guest email */}
                    {isGuest && (
                    <div>
                        <label className="block text-[0.65rem] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--muted)" }}>
                        Correo (para confirmacion)
                        </label>
                        <input
                        className="input"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="tu@correo.com"
                        inputMode="email"
                        />
                        <div className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                        Opcional. Si lo pones, te llega confirmacion por correo.
                        </div>
                    </div>
                    )}

                    {/* Phone */}
                    <div>
                    <label className="block text-[0.65rem] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--muted)" }}>
                        Telefono
                    </label>
                    <input
                        className="input disabled:opacity-60"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+521234567890 o 4431234567"
                        disabled={!isGuest}
                    />
                    </div>

                    {/* Error inside modal */}
                    {error && (
                    <div
                        className="animate-slide-down rounded-lg border px-3 py-2 text-xs"
                        style={{
                        borderColor: "rgba(220, 38, 38, 0.2)",
                        background: "rgba(254, 242, 242, 1)",
                        color: "rgb(153, 27, 27)",
                        }}
                    >
                        {error}
                    </div>
                    )}

                    {/* ===== PAYMENT: CHOOSE ===== */}
                    {paymentMode === "choose" && (
                    <div>
                        <div className="mb-3 text-[0.65rem] font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--muted)" }}>
                        Forma de pago
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {/* Online payment card — redirects to Mercado Pago's
                            Checkout Pro and back (see startMercadoPagoPayment) */}
                        <button
                            onClick={startMercadoPagoPayment}
                            disabled={saving || mpLoading || allowedDurations.length === 0}
                            className="group rounded-md border p-4 text-left transition-all duration-200 hover:shadow-sm disabled:opacity-50"
                            style={{
                            borderColor: "var(--brand-200)",
                            background: "var(--brand-50)",
                            }}
                            onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.borderColor = "var(--brand)"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--brand-200)"; }}
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="1" y="4" width="22" height="16" rx="3" />
                                <line x1="1" y1="10" x2="23" y2="10" />
                            </svg>
                            <div className="font-display mt-3 text-base font-semibold" style={{ color: "var(--brand-800)" }}>
                            {mpLoading ? "Preparando..." : "Pagar en linea"}
                            </div>
                            <div className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
                            Tarjeta o transferencia, con Mercado Pago
                            </div>
                        </button>

                        {/* Reception payment card — solo cambia de vista a un paso de
                            confirmacion explicito (ver paymentMode === "reception" abajo);
                            NO reserva todavia. Antes reservaba en este mismo click, lo
                            cual confundia a la gente porque no habia ningun aviso claro
                            de que ya se habia hecho la reserva. */}
                        <button
                            onClick={() => setPaymentMode("reception")}
                            disabled={saving || mpLoading || allowedDurations.length === 0}
                            className="group rounded-md border p-4 text-left transition-all duration-200 hover:shadow-sm disabled:opacity-50"
                            style={{
                            borderColor: "rgba(120,46,21,0.12)",
                            background: "var(--surface)",
                            }}
                            onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.borderColor = "var(--brand-200)"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(120,46,21,0.12)"; }}
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 21h18" />
                                <path d="M5 21V7l7-4 7 4v14" />
                                <path d="M9 21v-6h6v6" />
                                <path d="M10 10h4" />
                            </svg>
                            <div className="font-display mt-3 text-base font-semibold" style={{ color: "var(--foreground)" }}>
                            {saving ? "Confirmando..." : "Pagar en recepcion"}
                            </div>
                            <div className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
                            Efectivo o tarjeta al llegar
                            </div>
                        </button>
                        </div>

                        {mpError && (
                        <div
                            className="mt-3 animate-slide-down rounded-lg border px-3 py-2 text-xs"
                            style={{
                            borderColor: "rgba(220, 38, 38, 0.2)",
                            background: "rgba(254, 242, 242, 1)",
                            color: "rgb(153, 27, 27)",
                            }}
                        >
                            {mpError}
                        </div>
                        )}
                    </div>
                    )}

                    {/* ===== PAYMENT: RECEPTION CONFIRM ===== */}
                    {paymentMode === "reception" && (
                    <div>
                        <div
                        className="rounded-lg border px-4 py-3 text-sm animate-slide-down"
                        style={{ borderColor: "var(--brand-200)", background: "var(--brand-50)", color: "var(--brand-800)" }}
                        >
                        Vas a reservar <strong>{selected.court_name}</strong> el {formatDateES(dateYMD)} de{" "}
                        {parseISOToLocalTime(selected.start_at)}
                        {selectedEndAt && <> a {parseISOToLocalTime(selectedEndAt)}</>}. El pago se hace en recepcion al llegar.
                        </div>

                        <div className="mt-3 flex gap-3">
                        <button
                            type="button"
                            className="btn-secondary flex-1"
                            onClick={() => setPaymentMode("choose")}
                            disabled={saving}
                        >
                            Volver
                        </button>
                        <button
                            type="button"
                            className="btn-primary flex-1"
                            onClick={() => confirmBooking("RECEPTION")}
                            disabled={saving}
                        >
                            {saving ? "Confirmando..." : "Confirmar reserva"}
                        </button>
                        </div>
                    </div>
                    )}
                </div>

                {/* Modal footer */}
                <div
                    className="flex items-center justify-between px-6 py-4"
                    style={{
                    borderTop: "1px solid rgba(120, 46, 21, 0.08)",
                    background: "var(--surface-2)",
                    }}
                >
                    <div className="text-xs" style={{ color: "var(--muted)" }}>
                    Cambios: +52 1 434 116 8095
                    </div>
                    <button className="btn-secondary text-xs" onClick={cancelHoldAndClose} disabled={saving}>
                    Cancelar
                    </button>
                </div>
                </div>
            </div>
            </div>
        )}

        {/* ===== SUCCESS / TOLERANCE MODAL ===== */}
        {toleranceOpen && (
            <div
            className="fixed inset-0 z-[999] flex items-center justify-center px-4 animate-fade-in"
            style={{ background: "rgba(30, 27, 24, 0.45)", backdropFilter: "blur(4px)" }}
            >
            <div className="w-full max-w-md animate-slide-up">
                <div
                className="overflow-hidden rounded-2xl shadow-2xl"
                style={{
                    background: "linear-gradient(135deg, var(--brand-50) 0%, white 40%, white 100%)",
                    border: "1px solid var(--brand-100)",
                }}
                >
                {/* Success header */}
                <div className="px-6 pt-6 pb-4 text-center">
                    <div
                    className="mx-auto flex h-14 w-14 items-center justify-center rounded-full animate-checkmark"
                    style={{ background: "rgba(16, 185, 129, 0.12)", border: "2px solid rgba(16, 185, 129, 0.3)" }}
                    >
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgb(16, 185, 129)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                    </svg>
                    </div>
                    <h2 className="font-display mt-3 text-2xl font-semibold" style={{ color: "var(--foreground)" }}>
                    Reserva confirmada
                    </h2>
                    <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                    Tienes <span className="font-semibold" style={{ color: "var(--foreground)" }}>15 minutos</span> de tolerancia
                    para llegar a tu cancha.
                    </p>
                </div>

                {/* Email info */}
                <div className="px-6 pb-2">
                    <div
                    className="rounded-xl p-3 text-sm"
                    style={{
                        background: "white",
                        border: "1px solid rgba(120, 46, 21, 0.08)",
                        color: "var(--foreground)",
                    }}
                    >
                    {emailInfo?.to ? (
                        emailInfo.sent ? (
                        <div className="flex items-start gap-2">
                            <span className="mt-0.5 text-emerald-500">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="2" y="4" width="20" height="16" rx="2" />
                                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                            </svg>
                            </span>
                            <div>
                            Confirmacion enviada a{" "}
                            <span className="font-medium">{emailInfo.to}</span>
                            </div>
                        </div>
                        ) : (
                        <div>
                            <div className="flex items-start gap-2">
                            <span className="mt-0.5" style={{ color: "rgb(245, 158, 11)" }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                                </svg>
                            </span>
                            <div>
                                No se pudo enviar el correo a{" "}
                                <span className="font-medium">{emailInfo.to}</span>
                                {emailInfo.error && (
                                <div className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                                    {emailInfo.error}
                                </div>
                                )}
                            </div>
                            </div>
                        </div>
                        )
                    ) : (
                        <div style={{ color: "var(--muted)" }}>
                        Correo: no proporcionado.
                        </div>
                    )}
                    </div>
                </div>

                {/* CTA button */}
                <div className="px-6 pt-2 pb-6">
                    <button
                    className="btn-primary w-full py-3 text-sm"
                    onClick={() => {
                        setToleranceOpen(false);
                        setEmailInfo(null);
                    }}
                    >
                    Entendido
                    </button>
                </div>
                </div>
            </div>
            </div>
        )}
        </div>
    );
}

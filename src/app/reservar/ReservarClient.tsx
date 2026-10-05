"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { useRouter, useSearchParams } from "next/navigation";
import { computeExpectedAmountMXN, priceLabelForRange } from "@/lib/pricing-shared";
import {
  addMinutesIso,
  formatDateES,
  toYMDLocal,
  type AvailabilityResponse,
  type ConfirmedBooking,
  type CourtAvailability,
  type EmailInfo,
  type PaymentMode,
  type SelectedSlot,
  type Slot,
} from "./reservarUtils";
import CourtGrid from "./CourtGrid";
import BookingModal from "./BookingModal";
import BookingSuccessModal from "./BookingSuccessModal";
import { errorMessage } from "@/lib/errors";

// Checkout Pro redirects the browser away to Mercado Pago and back, so
// there's no embedded payment form/component to lazy-load here anymore
// (unlike the old Stripe Elements flow) — see startMercadoPagoPayment().
const MP_PENDING_KEY = "mp_pending_booking";

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

    const [selected, setSelected] = useState<SelectedSlot | null>(null);

    const [modalOpen, setModalOpen] = useState(false);

    const durations = useMemo(() => [60, 90, 120, 150, 180], []);
    const [durationMin, setDurationMin] = useState<number>(60);


    const [fullName, setFullName] = useState("");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");
    const [toleranceOpen, setToleranceOpen] = useState(false);
    const [emailInfo, setEmailInfo] = useState<EmailInfo | null>(null);
    // Snapshot taken right when a booking succeeds — `selected`/`fullName`
    // get cleared (or, after the Mercado Pago redirect, never repopulated:
    // it's a full page reload) before the tolerance modal renders, so the
    // modal can't read them live.
    const [confirmedBooking, setConfirmedBooking] = useState<ConfirmedBooking | null>(null);



    const [holdId, setHoldId] = useState<string | null>(null);

    // Payment state. "stripe" no longer exists as an in-page sub-mode:
    // Checkout Pro navigates the browser away immediately, so there's
    // nothing to render in between "choose" and coming back confirmed.
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
            // Suelta el horario en vez de dejarlo bloqueado hasta que venza.
            // El servidor revisa con Mercado Pago antes de borrar, así que
            // un pago que sí entró nunca se pierde.
            const holdToRelease = externalRef ?? pending?.booking_id;
            if (holdToRelease) {
            void fetch("/api/web/release-hold", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ booking_id: holdToRelease }),
            }).catch(() => {});
            }
        }
        return;
        }

        if (!externalRef || !paymentId || !pending || pending.booking_id !== externalRef) {
        // Regresó en otro navegador/dispositivo (sin los datos guardados de
        // esta pestaña). El webhook de Mercado Pago confirma la reserva y
        // manda el correo con los datos que ya se guardaron al iniciar el pago.
        setSuccessMsg(
            "Tu pago fue aprobado. Tu reserva se confirmará en unos momentos y te llegará el correo de confirmación."
        );
        return;
        }

        void finishMercadoPagoReturn(externalRef, paymentId, pending);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function finishMercadoPagoReturn(
        bookingId: string,
        mpPaymentId: string,
        pending: {
            full_name: string;
            phone: string;
            email?: string;
            court_name?: string;
            start_at?: string;
            date_ymd?: string;
        }
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
            to: (json?.email_to ?? null) as string | null,
            error: (json?.email_error ?? null) as string | null,
        });
        setConfirmedBooking({
            fullName: pending.full_name,
            courtName: pending.court_name ?? null,
            dateYMD: pending.date_ymd ?? null,
            startAt: pending.start_at ?? null,
        });
        setToleranceOpen(true);
        setSuccessMsg("Reserva confirmada y pagada en línea.");
        await loadAvailability(dateYMD);
        } finally {
        setSaving(false);
        }
    }

    async function loadAvailability(nextDate = dateYMD, opts?: { silent?: boolean; keepMessages?: boolean }) {
        const silent = !!opts?.silent;

        if (!silent) {
        setLoading(true);
        if (!opts?.keepMessages) {
            setError(null);
            setSuccessMsg(null);
        }
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
        } catch (e) {
        if (!silent) setError(errorMessage(e, "Error desconocido"));
        } finally {
        if (!silent) setLoading(false);
        }
    }

    useEffect(() => {
        // keepMessages: el efecto de regreso de Mercado Pago (arriba) puede
        // haber puesto un aviso en este mismo render — no borrarlo.
        loadAvailability(dateYMD, { keepMessages: true });
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
        } catch (e) {
        setError(errorMessage(e, "No se pudo crear el HOLD"));
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
        } catch (e) {
            if (e instanceof Error && e.name === "AbortError") return;
            setError(errorMessage(e, "No se pudo ajustar el HOLD"));
        }
        }, 250);

        return () => {
        controller.abort();
        clearTimeout(t);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [durationMin, modalOpen, holdId, selected?.start_at]);


    // Si el cliente cierra la pestaña (o navega a otro lado) con el modal
    // abierto, se suelta el apartado en vez de dejar la cancha bloqueada
    // hasta que venza. sendBeacon sí alcanza a salir mientras la página se
    // descarga. Excepción: la redirección al checkout de Mercado Pago, donde
    // el apartado debe seguir vivo.
    const leavingForPaymentRef = useRef(false);
    useEffect(() => {
        if (!modalOpen || !holdId) return;
        const onPageHide = () => {
        if (leavingForPaymentRef.current) return;
        const blob = new Blob([JSON.stringify({ booking_id: holdId })], { type: "application/json" });
        navigator.sendBeacon?.("/api/web/release-hold", blob);
        };
        window.addEventListener("pagehide", onPageHide);
        return () => window.removeEventListener("pagehide", onPageHide);
    }, [modalOpen, holdId]);

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
        if (!phone_input) { setError("Escribe tu teléfono."); return null; }
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


        setConfirmedBooking({
            fullName: v.full_name,
            courtName: selected.court_name,
            dateYMD,
            startAt: selected.start_at,
        });

        setModalOpen(false);
        setSelected(null);
        setHoldId(null);
        setFullName("");
        setPhone("");
        setPaymentMode("choose");

        setEmailInfo({
            sent: !!json?.email_sent,
            to: (json?.email_to ?? null) as string | null,
            error: (json?.email_error ?? null) as string | null,
        });
        setToleranceOpen(true);
        setSuccessMsg("Reserva confirmada. Tu pago se realiza en recepción.");
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
            court_name: selected?.court_name ?? undefined,
            start_at: selected?.start_at ?? undefined,
            date_ymd: dateYMD,
            })
        );

        // Los datos del cliente viajan con el link de pago para que el
        // servidor los ligue a la reserva antes del checkout — así el
        // webhook puede confirmar y mandar el correo aunque el cliente no
        // regrese a esta página.
        const r = await fetch("/api/web/create-mp-preference", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
            booking_id: holdId,
            full_name: v.full_name,
            phone: v.phone_input,
            email: email.trim() || undefined,
            }),
        });

        const json = await r.json().catch(() => ({}));
        if (!r.ok) {
            setMpError(json?.error ?? `Error ${r.status}`);
            sessionStorage.removeItem(MP_PENDING_KEY);
            return;
        }

        leavingForPaymentRef.current = true;
        window.location.href = json.init_point;
        } catch (e) {
        setMpError(errorMessage(e, "Error al iniciar el pago."));
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
                <h1 className="font-display text-[clamp(2.6rem,5vw,4rem)] leading-[1.02]">Reserva tu cancha.</h1>
                <p className="mt-3 max-w-md text-[var(--muted)]">
                Toca un horario libre para apartarlo.{isGuest ? " Estás reservando como invitado." : ""}
                </p>

                {isGuest && (
                <div className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
                    ¿Quieres que la próxima sea más rápido?{" "}
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
            <span className="font-display text-xl">{formatDateES(dateYMD)}</span>
            <span className="text-xs" style={{ color: "var(--muted)" }}>
                Intervalos de 30 min &middot; Hora de Pátzcuaro
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
            <CourtGrid
            availability={data?.availability ?? []}
            selected={selected}
            disabled={saving}
            onPick={pickSlot}
            />

            {/* ===== FOOTER NOTE ===== */}
            <div className="mt-8 border-t pt-4 text-xs leading-relaxed" style={{ color: "var(--muted)", borderColor: "rgba(120,46,21,0.15)" }}>
            El calendario muestra horarios en <b>intervalos de 30 min</b>. La reserva mínima es de{" "}
            <b>60 min</b>; la duración se elige después de seleccionar el horario.
            </div>
        </div>

        {/* ===== BOOKING MODAL ===== */}
        {modalOpen && selected && (
            <BookingModal
            selected={selected}
            dateYMD={dateYMD}
            selectedEndAt={selectedEndAt}
            durationMin={durationMin}
            setDurationMin={setDurationMin}
            allowedDurations={allowedDurations}
            priceInfo={priceInfo}
            isGuest={isGuest}
            fullName={fullName}
            setFullName={setFullName}
            email={email}
            setEmail={setEmail}
            phone={phone}
            setPhone={setPhone}
            error={error}
            paymentMode={paymentMode}
            setPaymentMode={setPaymentMode}
            saving={saving}
            mpLoading={mpLoading}
            mpError={mpError}
            onStartOnlinePayment={startMercadoPagoPayment}
            onConfirmReception={() => confirmBooking("RECEPTION")}
            onCancel={cancelHoldAndClose}
            />
        )}

        {/* ===== SUCCESS / TOLERANCE MODAL ===== */}
        {toleranceOpen && (
            <BookingSuccessModal
            confirmedBooking={confirmedBooking}
            emailInfo={emailInfo}
            onClose={() => {
                setToleranceOpen(false);
                setEmailInfo(null);
                setConfirmedBooking(null);
            }}
            />
        )}
        </div>
    );
}

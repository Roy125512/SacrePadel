"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { useRouter, useSearchParams } from "next/navigation";

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
  const offset = m ? m[1] : TZ;

  const [datePart, timeAndOffset] = iso.split("T");
  const timePart = timeAndOffset.slice(0, 8); // HH:mm:ss
  const [hh, mm, ss] = timePart.split(":").map((x) => Number(x));

  const total = hh * 60 + mm + minutes;

  const newH = Math.floor((total % (24 * 60) + 24 * 60) % (24 * 60) / 60);
  const newM = ((total % 60) + 60) % 60;

  return `${datePart}T${pad2(newH)}:${pad2(newM)}:${pad2(ss)}${offset}`;
}

// ===== Precio dinámico =====
// 07:00–17:59 => 350/h
// 18:00–21:59 => 400/h
const DAY_RATE = 350;
const EVENING_RATE = 400;
const SWITCH_HOUR = 18;

function rateAtMinute(iso: string) {
  const h = new Date(iso).getHours();
  return h >= SWITCH_HOUR ? EVENING_RATE : DAY_RATE;
}

// Prorratea por minuto (si cruza 18:00, cobra mixto)
function computeExpectedAmountMXN(startIso: string, endIso: string) {
  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return 0;

  let total = 0;
  for (let t = startMs; t < endMs; t += 60_000) {
    const next = Math.min(t + 60_000, endMs);
    const hours = (next - t) / 3_600_000;
    const rate = rateAtMinute(new Date(t).toISOString());
    total += hours * rate;
  }
  return Math.round(total);
}

function priceLabelForRange(startIso: string, endIso: string) {
  const startH = new Date(startIso).getHours();
  const endH = new Date(endIso).getHours();
  if (startH < SWITCH_HOUR && endH < SWITCH_HOUR) return "$350 / hora";
  if (startH >= SWITCH_HOUR) return "$400 / hora";
  return "Tarifa mixta (350/400)";
}

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
    // 👇 aquí se queda useSearchParams (pero ahora estará bajo Suspense porque el page lo envuelve)
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
    const [email, setEmail] = useState(""); // ✅ nuevo (solo guest)
    const [toleranceOpen, setToleranceOpen] = useState(false);
    const [emailInfo, setEmailInfo] = useState<{ sent: boolean; to: string | null; error: string | null } | null>(null);



    const [holdId, setHoldId] = useState<string | null>(null);

    useEffect(() => {
        if (isGuest) return;
        (async () => {
        const { data } = await supabaseBrowser.auth.getSession();
        if (!data.session?.user) router.replace("/inicio");
        })();
    }, [isGuest, router]);

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

        const step = data?.step_minutes ?? 30; // debe venir 30 desde availability
        const blocks = maxConsecutiveFreeBlocks(c.court_id, s.start_at);
        const maxMinutes = blocks * step;

        // ✅ Regla: mínimo 60 min. Si no hay 60 min continuos, no abrimos modal.
        if (maxMinutes < 60) {
        setError("No hay continuidad suficiente desde este inicio. Elige otro horario con al menos 60 minutos disponibles.");
        return;
        }

        // ✅ Default siempre 60 min (ya sabemos que sí se puede)
        const defaultDur = 60;
        setDurationMin(defaultDur);



        // ✅ Solo limpiar si es invitado (en usuario logueado NO se borra)
        if (isGuest) {
        setFullName("");
        setPhone("");
        setEmail("");
        }

        setModalOpen(true);


        if (!isGuest) {
        try {
            const { data: ses } = await supabaseBrowser.auth.getSession();
            const u = ses.session?.user;

            if (u) {
            // ✅ El email SIEMPRE viene de Auth (no de profiles)
            setEmail(u.email ?? "");

            // ✅ Nombre/teléfono desde profiles (solo columnas existentes)
            const { data: p, error: pErr } = await supabaseBrowser
                .from("profiles")
                .select("full_name, phone_e164")
                .eq("id", u.id)
                .maybeSingle();

            if (pErr) {
                console.warn("profiles select error:", pErr.message);
            }

            // ✅ Preferimos profiles, pero si viene vacío usamos fallback
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
        if (!modalOpen || !selected || !holdId) return;

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
            // ✅ Si se aborta por cambiar rápido duración, NO es error real
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
        setSaving(false);
        await loadAvailability(dateYMD);
        }
    }

    async function confirm() {
        if (!selected) return;
        if (!holdId) return setError("No hay HOLD activo. Vuelve a seleccionar el horario.");

        const full_name = fullName.trim();
        const phone_input = phone.trim();

        if (!full_name) return setError("Escribe tu nombre.");
        if (!phone_input) return setError("Escribe tu teléfono.");

        if (allowedDurations.length === 0) {
        return setError("No hay continuidad suficiente desde ese inicio. Elige otro horario.");
        }

        setSaving(true);
        setError(null);

        try {
        const r = await fetch("/api/web/confirm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
            booking_id: holdId,
            full_name,
            phone: phone_input,
            email: isGuest ? email.trim() : email.trim() || undefined,
            }),
        });

        const json = await r.json().catch(() => ({}));
        if (!r.ok) {
            setError(json?.error ?? `Error ${r.status}`);

            // Best-effort: intentar liberar HOLD sin generar otro error encima
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


        setEmailInfo({
            sent: !!json?.email_sent,
            to: (json?.email_to ?? null) as any,
            error: (json?.email_error ?? null) as any,
        });
        setToleranceOpen(true);

        setSuccessMsg("Reserva confirmada. Tu pago se realiza en recepción.");
        await loadAvailability(dateYMD);
        } finally {
        setSaving(false);
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
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
                <h1 className="section-title">
                Reservar {isGuest ? <span className="text-white/60">(Invitado)</span> : null}
                </h1>
                <p className="section-subtitle">
                Elige la hora de inicio (intervalos de 30 min) y la duración. El pago se realiza en recepción.

                </p>
                {isGuest && (
                <div className="mt-2 text-xs text-white/50">
                    ¿Quieres que la próxima sea más rápido?{" "}
                    <button className="underline" onClick={() => router.push("/perfil?next=/reservar")}>
                    Crear cuenta
                    </button>
                </div>
                )}
            </div>

            <div className="flex flex-wrap items-end gap-3">
                <div>
                <label className="block text-xs text-white/70">Fecha</label>
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
                {loading ? "Cargando…" : "Ver disponibilidad"}
                </button>
            </div>
            </div>

            <div className="mt-4 text-sm text-white/70">
            Fecha: <span className="text-white">{formatDateES(dateYMD)}</span> · Intervalos: 30 min · Hora local

            </div>

            {error && (
            <div className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {error}
            </div>
            )}

            {successMsg && (
            <div className="mt-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
                {successMsg}
            </div>
            )}

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            {(data?.availability ?? []).map((c) => (
                <div key={c.court_id} className="card p-4">
                <div className="mb-3 text-sm font-semibold text-white/90">{c.court_name}</div>

                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {c.slots.map((s) => {
                    const isBooked = !s.available;                 // bloque realmente ocupado
                    const canStart = s.can_start !== false;         // si no viene, asumimos true
                    const isStartDisabled = !canStart && !isBooked; // libre pero no puede iniciar (ej 21:30)

                    const isSelected =
                        !!selected &&
                        selected.court_id === c.court_id &&
                        selected.start_at === s.start_at;

                    const base =
                        "rounded-lg border px-2 py-2 text-xs font-medium transition " +
                        "focus:outline-none focus:ring-2 focus:ring-[#B46A4A]/35";

                    const available =
                        "border-black/10 bg-white text-black " +
                        "hover:bg-[#F3E7DE] hover:border-[#B46A4A]/45 hover:shadow-sm";

                    const cannotStart =
                        "border-black/10 bg-black/5 text-black/35 cursor-not-allowed";

                    const selectedCls =
                        "border-[#8E4A32] bg-gradient-to-r from-[#C77756] to-[#A85B3D] " +
                        "text-white shadow-md";

                    const booked =
                        "border-black/10 bg-black/5 text-black/35 cursor-not-allowed line-through";

                    return (
                        <button
                        key={`${c.court_id}-${s.start_at}`}
                        type="button"
                        onClick={() => pickSlot(c, s)}
                        disabled={isBooked || isStartDisabled || saving}
                        className={cx(
                            base,
                            isBooked
                            ? booked
                            : isSelected
                            ? selectedCls
                            : isStartDisabled
                            ? cannotStart
                            : available
                        )}
                        title={`${parseISOToLocalTime(s.start_at)}–${parseISOToLocalTime(s.end_at)} (30m)`}
                        >
                        {parseISOToLocalTime(s.start_at)}
                        </button>
                    );
                    })}


                </div>
                </div>
            ))}
            </div>

            <div className="mt-6 text-xs text-white/50">
            El calendario muestra disponibilidad por <b>bloques de 30 min</b>. La duración se elige después.
            </div>
        </div>

        {modalOpen && selected && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
            <div className="w-full max-w-md card">
                <div className="text-lg font-semibold">Confirmar reserva</div>

                <div className="mt-2 text-sm text-white/70">
                <span className="text-white">{selected.court_name}</span> · Inicio{" "}
                <span className="text-white">{parseISOToLocalTime(selected.start_at)}</span> ·{" "}
                <span className="text-white">{formatDateES(dateYMD)}</span>
                </div>

                <div className="mt-4">
                <label className="block text-xs text-white/70">Duración</label>
                <select
                    className="input w-full"
                    value={durationMin}
                    onChange={(e) => setDurationMin(Number(e.target.value))}
                    disabled={allowedDurations.length === 0}
                >
                    {allowedDurations.map((d) => (
                    <option key={d} value={d}>
                        {d} min
                    </option>
                    ))}
                </select>


                {allowedDurations.length === 0 && (
                    <div className="mt-2 text-xs text-red-200">
                    No hay continuidad suficiente desde ese inicio. Elige otro horario.
                    </div>
                )}
                </div>

                {priceInfo && selectedEndAt && (
                <div
                    className="mt-4 rounded-xl border bg-white/5 p-3"
                    style={{ borderColor: "rgba(255,255,255,0.12)" }}
                >
                    <div className="text-xs text-white/70">Precio</div>
                    <div className="mt-1 text-sm text-white/80">
                    Tarifa: <span className="font-semibold text-white">{priceInfo.label}</span>
                    </div>
                    <div className="mt-1 text-lg font-semibold text-white">
                    Total: ${priceInfo.total} MXN
                    </div>

                    <div className="mt-1 text-xs text-white/50">
                    Fin: <span className="text-white/70">{parseISOToLocalTime(selectedEndAt)}</span>
                    </div>
                </div>
                )}


                

                <div className="mt-4">
                <label className="block text-xs text-white/70">Nombre</label>
                <input
                    className="input disabled:opacity-70"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Tu nombre completo"
                    disabled={!isGuest}
                />
                {!isGuest && <div className="mt-1 text-xs text-[#5a3a2a]/80">Tus datos vienen de tu perfil.</div>}
                </div>

                {isGuest && (
                <div className="mt-3">
                    <label className="block text-xs text-white/70">Correo (para confirmación)</label>
                    <input
                    className="input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@correo.com"
                    inputMode="email"
                    />
                    <div className="mt-1 text-xs text-[#5a3a2a]/80">
                    Opcional. Si lo pones, te llega confirmación por correo.
                    </div>
                </div>
                )}


                <div className="mt-3">
                <label className="block text-xs text-white/70">Teléfono</label>
                <input
                    className="input disabled:opacity-70"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+521234567890 o 4431234567"
                    disabled={!isGuest}
                />
                <div className="mt-1 text-xs text-[#5a3a2a]/80">Se normaliza automáticamente al confirmar.</div>
                </div>

                <div className="mt-5 flex justify-end gap-2">
                <button className="btn-secondary" onClick={cancelHoldAndClose} disabled={saving}>
                    Cancelar
                </button>

                <button
                    className="btn-primary"
                    onClick={confirm}
                    disabled={saving || allowedDurations.length === 0}
                >
                    {saving ? "Confirmando…" : "Confirmar (pago en recepción)"}
                </button>
                </div>

                <div className="mt-3 text-xs text-white/50">
                Se reservará exactamente el rango elegido. Si cancelas, se libera el bloqueo. Para cancelar, llama al +52 452 115 8507.

                </div>
            </div>
            </div>
        )}

        {toleranceOpen && (
            <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 px-4">
            <div className="w-full max-w-md rounded-2xl border border-[#D8B7A3] bg-gradient-to-br from-[#F6EDE6] to-[#EAD6C8] p-5 shadow-xl">
                <div className="text-lg font-semibold text-[#3b241a]">Reserva confirmada</div>
                <div className="mt-2 text-sm text-[#4a2e21]">
                Tienes <span className="font-semibold text-[#3b241a]">15 minutos</span> de tolerancia.
                </div>

                <div className="mt-3 rounded-xl border border-[#D8B7A3] bg-white/60 p-3 text-sm text-[#4a2e21]">
                {emailInfo?.to ? (
                    emailInfo.sent ? (
                    <div>
                        📩 Confirmación enviada a{" "}
                        <span className="text-[#3b241a] font-medium">{emailInfo.to}</span>.
                    </div>
                    ) : (
                    <div>
                        ⚠️ No se pudo enviar el correo a{" "}
                        <span className="text-[#3b241a] font-medium">{emailInfo.to}</span>.
                        <div className="mt-1 text-xs text-[#5a3a2a]/80">
                        {emailInfo.error ?? "Error desconocido"}
                        </div>
                    </div>
                    )
                ) : (
                    <div>Correo: no proporcionado.</div>
                )}
                </div>

                <div className="mt-4 flex justify-end">
                <button
                    className="btn-primary"
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
        )}
        </div>
    );
}


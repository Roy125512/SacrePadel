"use client";

import { MAX_PADDLE_RENTALS, PADDLE_RENTAL_PRICE } from "@/lib/pricing-shared";
import { formatDateES, parseISOToLocalTime, type OpenMatchSettings, type PaymentMode, type SelectedSlot } from "./reservarUtils";
import {
  CANCEL_NOTICE_HOURS,
  DEFAULT_SPLIT_PARTS,
  DIVISIONS,
  MATCH_PLAYERS,
  SPLIT_DEBT_GRACE_HOURS,
  SPLIT_PARTS_OPTIONS,
  formatMXN,
  splitAmounts,
} from "@/lib/config";

/**
 * Modal para confirmar la reserva: duración, precio, datos del cliente y
 * forma de pago. Solo presenta: el estado y las llamadas a la API viven en
 * ReservarClient.
 */
export default function BookingModal({
  selected,
  dateYMD,
  selectedEndAt,
  durationMin,
  setDurationMin,
  allowedDurations,
  priceInfo,
  isGuest,
  fullName,
  setFullName,
  email,
  setEmail,
  phone,
  setPhone,
  error,
  errorLink,
  splitParts,
  setSplitParts,
  openMatch,
  setOpenMatch,
  paddles,
  setPaddles,
  paymentMode,
  setPaymentMode,
  saving,
  mpLoading,
  mpError,
  onStartOnlinePayment,
  onConfirmReception,
  onCancel,
}: {
  selected: SelectedSlot;
  dateYMD: string;
  selectedEndAt: string | null;
  durationMin: number;
  setDurationMin: (minutes: number) => void;
  allowedDurations: number[];
  priceInfo: { total: number; label: string } | null;
  isGuest: boolean;
  fullName: string;
  setFullName: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  error: string | null;
  /** Liga para resolver el error (p. ej. pagar una deuda de pago dividido). */
  errorLink?: { href: string; label: string } | null;
  /** null = pago completo; 2–4 = dividido entre ese número de jugadores. */
  splitParts: number | null;
  setSplitParts: (n: number | null) => void;
  /** Partido abierto (se publica en /partidos); null = no. */
  openMatch: OpenMatchSettings | null;
  setOpenMatch: (m: OpenMatchSettings | null) => void;
  /** Palas a rentar ($50 c/u). */
  paddles: number;
  setPaddles: (n: number) => void;
  paymentMode: PaymentMode;
  setPaymentMode: (mode: PaymentMode) => void;
  saving: boolean;
  mpLoading: boolean;
  mpError: string | null;
  onStartOnlinePayment: () => void;
  onConfirmReception: () => void;
  onCancel: () => void;
}) {
  const parts = openMatch ? MATCH_PLAYERS : splitParts;
  const shares = priceInfo && parts ? splitAmounts(priceInfo.total, parts) : null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto px-4 py-4 animate-fade-in"
    style={{ background: "rgba(30, 27, 24, 0.45)", backdropFilter: "blur(4px)" }}
    >
    <div className="w-full max-w-md my-auto animate-slide-up">
        <div className="overflow-hidden rounded-[4px] bg-[var(--surface)] shadow-2xl" style={{ border: "1px solid var(--line)" }}>

        {/* Encabezado oscuro, como la portada */}
        <div className="px-6 py-5" style={{ background: "var(--dark)" }}>
            <span className="text-[0.7rem] font-semibold uppercase tracking-[0.24em]" style={{ color: "var(--brand-highlight)" }}>
            Confirmar reserva
            </span>
            <h2 className="font-display mt-1 text-3xl leading-tight" style={{ color: "#F6F0E6" }}>
            {selected.court_name}
            </h2>
            <div className="mt-1 text-sm" style={{ color: "rgba(246, 240, 230, 0.78)" }}>
            {formatDateES(dateYMD)}
            </div>

            {selectedEndAt && (
            <div className="mt-4 flex flex-wrap items-baseline gap-2">
                <span className="font-display text-3xl tabular-nums" style={{ color: "#F6F0E6" }}>
                {parseISOToLocalTime(selected.start_at)}&ndash;{parseISOToLocalTime(selectedEndAt)}
                </span>
                <span className="border px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-[0.18em]" style={{ borderColor: "rgba(241,236,227,.3)", color: "rgba(241,236,227,.8)" }}>
                {durationMin} min
                </span>
            </div>
            )}
        </div>

        {/* Modal body */}
        <div className="px-6 py-5 space-y-4">

            {/* Duration */}
            <div>
            <label className="block text-sm font-medium" style={{ color: "var(--muted)" }}>
                Duración
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
                La duración queda fija una vez que inicias el pago.
                </div>
            )}
            </div>

            {/* Price card */}
            {priceInfo && selectedEndAt && (
            <div className="flex items-end justify-between gap-3 border-t pt-4" style={{ borderColor: "rgba(120,46,21,0.15)" }}>
                <div>
                    <div className="text-sm font-medium" style={{ color: "var(--muted)" }}>
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

            {/* Renta de pala */}
            {priceInfo && selectedEndAt && (
            <div className="flex items-center justify-between gap-3">
                <div>
                <div className="text-sm font-medium" style={{ color: "var(--muted)" }}>
                    ¿Rentas pala?
                </div>
                <div className="text-xs" style={{ color: "var(--muted)" }}>
                    ${PADDLE_RENTAL_PRICE} c/u
                    {paddles > 0 && (splitParts || openMatch || paymentMode === "reception")
                    ? " · se paga en recepción"
                    : paddles > 0
                        ? ` · total con palas $${priceInfo.total + paddles * PADDLE_RENTAL_PRICE}`
                        : ""}
                </div>
                </div>
                <div className="flex items-center gap-2" role="group" aria-label="Palas a rentar">
                <button
                    type="button"
                    aria-label="Una pala menos"
                    className="h-8 w-8 rounded-full border text-base leading-none disabled:opacity-40"
                    style={{ borderColor: "var(--brand-200)" }}
                    onClick={() => setPaddles(Math.max(0, paddles - 1))}
                    disabled={paddles === 0 || mpLoading || saving}
                >
                    −
                </button>
                <span className="w-5 text-center text-sm font-semibold tabular-nums" aria-live="polite">
                    {paddles}
                </span>
                <button
                    type="button"
                    aria-label="Una pala más"
                    className="h-8 w-8 rounded-full border text-base leading-none disabled:opacity-40"
                    style={{ borderColor: "var(--brand-200)" }}
                    onClick={() => setPaddles(Math.min(MAX_PADDLE_RENTALS, paddles + 1))}
                    disabled={paddles === MAX_PADDLE_RENTALS || mpLoading || saving}
                >
                    +
                </button>
                </div>
            </div>
            )}

            {/* Name */}
            <div>
            <label className="block text-sm font-medium" style={{ color: "var(--muted)" }}>
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
                <label className="block text-sm font-medium" style={{ color: "var(--muted)" }}>
                Correo (para confirmación)
                </label>
                <input
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                inputMode="email"
                />
                <div className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                Opcional. Si lo pones, te llega confirmación por correo.
                </div>
            </div>
            )}

            {/* Phone */}
            <div>
            <label className="block text-sm font-medium" style={{ color: "var(--muted)" }}>
                Teléfono
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
                {errorLink && (
                <a href={errorLink.href} className="mt-1.5 block font-semibold underline underline-offset-2">
                    {errorLink.label}
                </a>
                )}
            </div>
            )}

            {/* ===== PAYMENT: CHOOSE ===== */}
            {paymentMode === "choose" && (
            <div>
                {/* Pago dividido (como Playtomic): cada jugador paga su parte */}
                {priceInfo && (
                <div className="mb-5">
                    <div className="mb-2 text-sm font-medium" style={{ color: "var(--muted)" }}>
                    ¿Cómo pagan?
                    </div>
                    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Cómo pagan">
                    {[
                        {
                        on: !splitParts && !openMatch,
                        title: "Pago completo",
                        sub: `Tú pagas ${formatMXN(priceInfo.total + paddles * PADDLE_RENTAL_PRICE)}`,
                        pick: () => {
                            setOpenMatch(null);
                            setSplitParts(null);
                        },
                        },
                        {
                        on: !!splitParts && !openMatch,
                        title: "Dividir el pago",
                        sub: "Cada quien su parte",
                        pick: () => {
                            setOpenMatch(null);
                            setSplitParts(splitParts ?? DEFAULT_SPLIT_PARTS);
                        },
                        },
                        {
                        on: !!openMatch,
                        title: "Partido abierto",
                        sub: isGuest ? "Requiere cuenta" : "Que se unan otros",
                        locked: isGuest,
                        pick: () => {
                            setSplitParts(null);
                            setOpenMatch(openMatch ?? { type: "FRIENDLY", gender: "ANY", level_min: 1, level_max: 6 });
                        },
                        },
                    ].map((o) => (
                        <button
                        key={o.title}
                        type="button"
                        role="radio"
                        aria-checked={o.on}
                        onClick={o.pick}
                        disabled={mpLoading || saving || !!o.locked}
                        className="rounded-md border px-2.5 py-2.5 text-left transition-colors disabled:opacity-50"
                        style={{
                            borderColor: o.on ? "var(--brand)" : "rgba(120,46,21,0.15)",
                            background: o.on ? "var(--brand-50)" : "var(--surface)",
                        }}
                        >
                        <div className="text-sm font-semibold" style={{ color: o.on ? "var(--brand-800)" : "var(--foreground)" }}>
                            {o.title}
                        </div>
                        <div className="text-xs" style={{ color: "var(--muted)" }}>{o.sub}</div>
                        </button>
                    ))}
                    </div>

                    {openMatch && shares && (
                    <div className="mt-3 animate-slide-down space-y-3 rounded-md border px-3 py-3 text-xs leading-relaxed" style={{ borderColor: "var(--brand-200)", background: "var(--brand-50)", color: "var(--brand-800)" }}>
                        {(
                        [
                            {
                            label: "Tipo",
                            key: "type",
                            opts: [
                                ["FRIENDLY", "Amistoso"],
                                ["COMPETITIVE", "Competitivo"],
                            ],
                            },
                            {
                            label: "Para",
                            key: "gender",
                            opts: [
                                ["ANY", "Todos"],
                                ["MALE", "Varonil"],
                                ["FEMALE", "Femenil"],
                            ],
                            },
                        ] as const
                        ).map((row) => (
                        <div key={row.key} className="flex flex-wrap items-center gap-1.5">
                            <span className="w-12 shrink-0">{row.label}</span>
                            {row.opts.map(([v, l]) => {
                            const on = openMatch[row.key] === v;
                            return (
                                <button
                                key={v}
                                type="button"
                                aria-pressed={on}
                                onClick={() => setOpenMatch({ ...openMatch, [row.key]: v })}
                                className="rounded-full border px-2.5 py-1 font-semibold"
                                style={{
                                    borderColor: on ? "var(--brand)" : "var(--brand-200)",
                                    background: on ? "var(--brand)" : "transparent",
                                    color: on ? "#fff" : "var(--brand-800)",
                                }}
                                >
                                {l}
                                </button>
                            );
                            })}
                        </div>
                        ))}
                        <div className="flex flex-wrap items-center gap-1.5">
                        <span className="w-12 shrink-0">Nivel</span>
                        <select
                            aria-label="Nivel desde"
                            className="rounded border bg-white px-1.5 py-1"
                            style={{ borderColor: "var(--brand-200)" }}
                            value={openMatch.level_min}
                            onChange={(e) => {
                            const v = Number(e.target.value);
                            setOpenMatch({ ...openMatch, level_min: v, level_max: Math.max(v, openMatch.level_max) });
                            }}
                        >
                            {DIVISIONS.map((d) => (
                            <option key={d.n} value={d.n}>{d.code}</option>
                            ))}
                        </select>
                        <span>a</span>
                        <select
                            aria-label="Nivel hasta"
                            className="rounded border bg-white px-1.5 py-1"
                            style={{ borderColor: "var(--brand-200)" }}
                            value={openMatch.level_max}
                            onChange={(e) => {
                            const v = Number(e.target.value);
                            setOpenMatch({ ...openMatch, level_max: v, level_min: Math.min(v, openMatch.level_min) });
                            }}
                        >
                            {DIVISIONS.map((d) => (
                            <option key={d.n} value={d.n}>{d.code}</option>
                            ))}
                        </select>
                        </div>
                        <p>
                        Ahora pagas tu lugar: <b className="tabular-nums">{formatMXN(shares[0])}</b>. Publicamos el partido en{" "}
                        <b>Partidos</b> para que se unan 3 jugadores, cada uno pagando el suyo ({formatMXN(shares[1])}). Si no se
                        llena, lo que falte queda a tu cargo, o cancela sin costo hasta {CANCEL_NOTICE_HOURS} h antes.
                        </p>
                    </div>
                    )}

                    {splitParts && !openMatch && shares && (
                    <div className="mt-3 animate-slide-down rounded-md border px-3 py-3 text-xs leading-relaxed" style={{ borderColor: "var(--brand-200)", background: "var(--brand-50)", color: "var(--brand-800)" }}>
                        <div className="flex items-center gap-2">
                        <span>Entre</span>
                        {SPLIT_PARTS_OPTIONS.map((n) => (
                            <button
                            key={n}
                            type="button"
                            onClick={() => setSplitParts(n)}
                            aria-pressed={splitParts === n}
                            className="h-8 w-8 rounded-full border text-sm font-semibold tabular-nums"
                            style={{
                                borderColor: splitParts === n ? "var(--brand)" : "var(--brand-200)",
                                background: splitParts === n ? "var(--brand)" : "transparent",
                                color: splitParts === n ? "#fff" : "var(--brand-800)",
                            }}
                            >
                            {n}
                            </button>
                        ))}
                        <span>jugadores</span>
                        </div>
                        <p className="mt-2.5">
                        Ahora pagas tu parte: <b className="tabular-nums">{formatMXN(shares[0])}</b>. Te damos una liga para que cada
                        quien pague la suya ({formatMXN(shares[shares.length - 1])}) desde su celular, sin cuenta. Lo que no se pague
                        hasta {SPLIT_DEBT_GRACE_HOURS} h después del partido queda a tu cargo.
                        </p>
                    </div>
                    )}
                </div>
                )}

                <div className="mb-3 text-sm font-medium" style={{ color: "var(--muted)" }}>
                Forma de pago
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {/* Online payment card — redirects to Mercado Pago's
                    Checkout Pro and back (ver startMercadoPagoPayment en ReservarClient) */}
                <button
                    onClick={onStartOnlinePayment}
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
                    {mpLoading
                      ? "Preparando..."
                      : openMatch && shares
                        ? `Pagar mi lugar · ${formatMXN(shares[0])}`
                        : shares
                          ? `Pagar mi parte · ${formatMXN(shares[0])}`
                          : "Pagar en línea"}
                    </div>
                    <div className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
                    Tarjeta o transferencia, con Mercado Pago
                    </div>
                </button>

                {/* Reception payment card — solo cambia de vista a un paso de
                    confirmación explicito (ver paymentMode === "reception" abajo);
                    NO reserva todavia. Antes reservaba en este mismo click, lo
                    cual confundia a la gente porque no habia ningun aviso claro
                    de que ya se habia hecho la reserva. */}
                <button
                    onClick={() => setPaymentMode("reception")}
                    disabled={saving || mpLoading || allowedDurations.length === 0 || !!splitParts || !!openMatch}
                    title={splitParts || openMatch ? "El pago dividido es en línea" : undefined}
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
                    {saving ? "Confirmando..." : "Pagar en recepción"}
                    </div>
                    <div className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
                    {splitParts || openMatch ? "Solo con pago completo" : "Efectivo o tarjeta al llegar"}
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

                <p className="mt-3 text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
                Cancelación sin costo hasta {CANCEL_NOTICE_HOURS} h antes. Si pagas en línea y cancelas a tiempo, te
                devolvemos el pago automáticamente.
                </p>
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
                {selectedEndAt && <> a {parseISOToLocalTime(selectedEndAt)}</>}. El pago se hace en recepción al llegar.
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
                    onClick={onConfirmReception}
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
            <button className="btn-secondary text-xs" onClick={onCancel} disabled={saving}>
            Cancelar
            </button>
        </div>
        </div>
    </div>
    </div>
  );
}

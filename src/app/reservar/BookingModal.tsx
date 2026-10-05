"use client";

import { formatDateES, parseISOToLocalTime, type PaymentMode, type SelectedSlot } from "./reservarUtils";

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
  paymentMode: PaymentMode;
  setPaymentMode: (mode: PaymentMode) => void;
  saving: boolean;
  mpLoading: boolean;
  mpError: string | null;
  onStartOnlinePayment: () => void;
  onConfirmReception: () => void;
  onCancel: () => void;
}) {
  return (
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

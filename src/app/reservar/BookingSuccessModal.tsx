"use client";

import { WHATSAPP_PHONE } from "@/components/WhatsAppButton";
import { formatDateES, parseISOToLocalTime, type ConfirmedBooking, type EmailInfo } from "./reservarUtils";

/** "Reserva confirmada": tolerancia, estado del correo y aviso por WhatsApp. */
export default function BookingSuccessModal({
  confirmedBooking,
  emailInfo,
  onClose,
}: {
  confirmedBooking: ConfirmedBooking | null;
  emailInfo: EmailInfo | null;
  onClose: () => void;
}) {
  return (
    <div
    className="fixed inset-0 z-[999] flex items-center justify-center px-4 animate-fade-in"
    style={{ background: "rgba(30, 27, 24, 0.45)", backdropFilter: "blur(4px)" }}
    >
    <div className="w-full max-w-md animate-slide-up">
        <div
        className="overflow-hidden rounded-[4px] shadow-2xl"
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
                    Confirmación enviada a{" "}
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

        {/* Compromiso: hospitalidad, no política de cancelación */}
        <div className="px-6 pb-2">
            <div
            className="rounded-xl p-4 text-sm"
            style={{
                background: "var(--brand-50)",
                border: "1px solid var(--brand-100)",
                color: "var(--foreground)",
            }}
            >
            <p className="font-display text-[0.95rem] font-semibold" style={{ color: "var(--brand)" }}>
                Un compromiso, no solo una reserva
            </p>
            <p className="mt-1.5 leading-relaxed" style={{ color: "var(--muted)" }}>
                {confirmedBooking?.fullName.trim().split(" ")[0]
                ? `${confirmedBooking.fullName.trim().split(" ")[0]}, tu`
                : "Tu"}{" "}
                cancha queda apartada solo para ti — nadie más la va a tomar. Si al final no
                puedes venir, un mensaje con un poco de anticipación es todo lo que necesitamos
                para dársela a alguien que sí la está esperando. Gracias por cuidar tu lugar.
            </p>
            <a
                href={`https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(
                confirmedBooking?.courtName && confirmedBooking?.dateYMD && confirmedBooking?.startAt
                    ? `Hola, soy ${confirmedBooking.fullName.trim() || "un cliente"}. Reservé ${
                        confirmedBooking.courtName
                    } el ${formatDateES(confirmedBooking.dateYMD)} a las ${parseISOToLocalTime(
                        confirmedBooking.startAt
                    )} y no voy a poder llegar. ¿Podrían liberar el horario? ¡Gracias!`
                    : `Hola, soy ${
                        confirmedBooking?.fullName.trim() || "un cliente"
                    }. Reservé una cancha y no voy a poder llegar. ¿Podrían liberar el horario? ¡Gracias!`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-semibold underline underline-offset-2"
                style={{ color: "var(--brand)" }}
            >
                Avisar que no podré llegar
            </a>
            </div>
        </div>

        {/* CTA button */}
        <div className="px-6 pt-2 pb-6">
            <button
            className="btn-primary w-full py-3 text-sm"
            onClick={onClose}
            >
            Entendido
            </button>
        </div>
        </div>
    </div>
    </div>
  );
}

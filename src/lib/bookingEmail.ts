function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

export function buildBookingConfirmationEmail(a: {
  clubName?: string;
  fullName: string;
  courtName: string;
  dateLocal: string;
  startTimeLocal: string;
  endTimeLocal: string;
  toleranceMinutes?: number;
}) {
  const club = a.clubName ?? "Sacré Pádel";
  const tol = a.toleranceMinutes ?? 15;

  const subject = `Confirmación de reserva - ${club}`;

  const text = [
    `Hola ${a.fullName},`,
    "",
    `Tu reserva quedó confirmada en ${club}.`,
    `Cancha: ${a.courtName}`,
    `Fecha: ${a.dateLocal}`,
    `Horario: ${a.startTimeLocal} - ${a.endTimeLocal}`,
    "",
    `Tienes ${tol} minutos de tolerancia.`,
    "Pago en recepción.",
    "",
    "Si necesitas cancelar, por favor llama al +52 452 115 8507.",
  ].join("\n");

  const html = `
  <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; line-height:1.4; color:#111;">
    <h2 style="margin:0 0 10px;">Confirmación de reserva</h2>
    <p style="margin:0 0 14px;">Hola <b>${esc(a.fullName)}</b>, tu reserva quedó confirmada en <b>${esc(
    club
  )}</b>.</p>

    <div style="border:1px solid #e5e7eb; border-radius:12px; padding:14px; background:#fafafa;">
      <div><b>Cancha:</b> ${esc(a.courtName)}</div>
      <div><b>Fecha:</b> ${esc(a.dateLocal)}</div>
      <div><b>Horario:</b> ${esc(a.startTimeLocal)} - ${esc(a.endTimeLocal)}</div>
      <div style="margin-top:10px;"><b>Tolerancia:</b> ${tol} minutos</div>
      <div><b>Pago:</b> en recepción</div>

      <div style="margin-top:12px; font-size:13px; color:#374151;">
        Si necesitas cancelar, por favor llama al <b>+52 452 115 8507</b>.
      </div>
    </div>
  </div>`;

  return { subject, text, html };
}

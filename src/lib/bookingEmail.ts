function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

export function buildBookingConfirmationEmail(a: {
  clubName?: string;
  logoUrl?: string; // <-- NUEVO
  fullName: string;
  courtName: string;
  dateLocal: string;
  startTimeLocal: string;
  endTimeLocal: string;
  toleranceMinutes?: number;
}) {
  const club = a.clubName ?? "Sacré Pádel";
  const tol = a.toleranceMinutes ?? 15;

  // Cambia esto si decides otra ruta/archivo:
  const logo =
    a.logoUrl ?? "https://sacrepadel.com/email/logo.png";

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

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f6efe9;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6efe9;padding:24px 0;">
      <tr>
        <td align="center" style="padding:0 12px;">
          <table role="presentation" width="520" cellspacing="0" cellpadding="0" style="width:520px;max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #f0e2d8;">
            <tr>
              <td style="padding:18px 20px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="vertical-align:middle;">
                      <table role="presentation" cellspacing="0" cellpadding="0">
                        <tr>
                          <td style="vertical-align:middle;">
                            <img src="${esc(logo)}" width="40" height="40" alt="${esc(
    club
  )}"
                              style="display:block;border:0;outline:none;text-decoration:none;border-radius:10px;" />
                          </td>
                          <td style="vertical-align:middle;padding-left:12px;">
                            <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:#111;font-weight:800;letter-spacing:1px;">
                              ${esc(club).toUpperCase()}
                            </div>
                            <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:#6b7280;font-size:12px;margin-top:2px;">
                              Confirmación de reserva
                            </div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                <div style="height:14px"></div>

                <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:#111;font-size:18px;font-weight:800;">
                  ¡Reserva confirmada!
                </div>

                <div style="height:8px"></div>

                <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:#374151;font-size:14px;line-height:1.5;">
                  Hola <b>${esc(a.fullName)}</b>, tu reserva quedó confirmada.
                </div>

                <div style="height:14px"></div>

                <div style="border:1px solid #e9d5c7;border-radius:14px;padding:14px;background:#fff7f1;">
                  <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:#111;font-size:14px;line-height:1.6;">
                    <div><b>Cancha:</b> ${esc(a.courtName)}</div>
                    <div><b>Fecha:</b> ${esc(a.dateLocal)}</div>
                    <div><b>Horario:</b> ${esc(a.startTimeLocal)} – ${esc(a.endTimeLocal)}</div>
                    <div style="margin-top:10px;"><b>Tolerancia:</b> ${tol} min</div>
                    <div><b>Pago:</b> en recepción</div>
                  </div>

                  <div style="margin-top:12px;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;font-size:12px;color:#6b7280;line-height:1.5;">
                    Si necesitas cancelar, por favor llama al <b style="color:#111;">+52 452 115 8507</b>.
                  </div>
                </div>

                <div style="height:16px"></div>

                <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;font-size:12px;color:#9ca3af;">
                  © ${new Date().getFullYear()} ${esc(club)}
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}

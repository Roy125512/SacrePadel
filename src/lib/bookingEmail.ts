function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

export function buildBookingConfirmationEmail(a: {
  clubName?: string;
  logoUrl?: string;
  fullName: string;
  courtName: string;
  dateLocal: string;
  startTimeLocal: string;
  endTimeLocal: string;
  toleranceMinutes?: number;
  paymentMethod?: "STRIPE" | "MERCADOPAGO" | "RECEPTION";
  amountMXN?: number;
  /** Liga para cancelar en línea (política de cancelación). */
  cancelUrl?: string;
  cancelNoticeHours?: number;
}) {
  const club = a.clubName ?? "Sacré Pádel";
  const tol = a.toleranceMinutes ?? 15;
  const hrs = a.cancelNoticeHours ?? 24;
  const cancelText = a.cancelUrl
    ? `Puedes cancelar sin costo hasta ${hrs} h antes desde esta liga: ${a.cancelUrl}${
        a.paymentMethod === "MERCADOPAGO" ? " (te devolvemos tu pago automáticamente)." : "."
      } Después de ese plazo, escríbenos al +52 1 434 116 8095.`
    : "Si necesitas cancelar, por favor llama al +52 1 434 116 8095.";

  // Cambia esto si decides otra ruta/archivo:
  const logo =
    a.logoUrl ?? "https://sacrepadel.com/email/logo.png";

  const subject = `Confirmación de reserva - ${club}`;

  const paidOnline = (a.paymentMethod === "STRIPE" || a.paymentMethod === "MERCADOPAGO") && a.amountMXN;
  const paymentLine = paidOnline
    ? `Pagado en línea ($${a.amountMXN} MXN).`
    : "Pago en recepción.";

  const text = [
    `Hola ${a.fullName},`,
    "",
    `Tu reserva quedó confirmada en ${club}.`,
    `Cancha: ${a.courtName}`,
    `Fecha: ${a.dateLocal}`,
    `Horario: ${a.startTimeLocal} - ${a.endTimeLocal}`,
    "",
    `Tienes ${tol} minutos de tolerancia.`,
    paymentLine,
    "",
    cancelText,
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
                    <div><b>Pago:</b> ${paidOnline ? `Pagado en línea ($${a.amountMXN} MXN)` : "en recepción"}</div>
                  </div>

                  <div style="margin-top:12px;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;font-size:12px;color:#6b7280;line-height:1.5;">
                    ${
                      a.cancelUrl
                        ? `Cancelación sin costo hasta <b style="color:#111;">${hrs} h antes</b>${
                            a.paymentMethod === "MERCADOPAGO" ? " (te devolvemos tu pago automáticamente)" : ""
                          }. <a href="${esc(a.cancelUrl)}" style="color:#9A6A45;font-weight:700;">Cancelar mi reserva</a><br/>Después de ese plazo, escríbenos al <b style="color:#111;">+52 1 434 116 8095</b>.`
                        : `Si necesitas cancelar, por favor llama al <b style="color:#111;">+52 1 434 116 8095</b>.`
                    }
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

/**
 * Email sent to the business owner/admin when a new booking is confirmed.
 */
export function buildOwnerNotificationEmail(a: {
  clubName?: string;
  logoUrl?: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  courtName: string;
  dateLocal: string;
  startTimeLocal: string;
  endTimeLocal: string;
  paymentMethod?: "STRIPE" | "MERCADOPAGO" | "RECEPTION";
  amountMXN?: number;
}) {
  const club = a.clubName ?? "Sacre Padel";
  const logo =
    a.logoUrl ?? "https://sacrepadel.com/email/logo.png";

  const subject = `Nueva reserva - ${esc(a.courtName)} ${esc(a.dateLocal)} ${esc(a.startTimeLocal)}`;

  const paidOnline = (a.paymentMethod === "STRIPE" || a.paymentMethod === "MERCADOPAGO") && a.amountMXN;
  const paymentLine = paidOnline
    ? `Pagado en linea ($${a.amountMXN} MXN)`
    : "Pago en recepcion (pendiente)";

  const text = [
    `Nueva reserva en ${club}`,
    "",
    `Cliente: ${a.customerName}`,
    `Telefono: ${a.customerPhone}`,
    a.customerEmail ? `Correo: ${a.customerEmail}` : "",
    "",
    `Cancha: ${a.courtName}`,
    `Fecha: ${a.dateLocal}`,
    `Horario: ${a.startTimeLocal} - ${a.endTimeLocal}`,
    `Pago: ${paymentLine}`,
  ]
    .filter(Boolean)
    .join("\n");

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
                            <img src="${esc(logo)}" width="40" height="40" alt="${esc(club)}"
                              style="display:block;border:0;outline:none;text-decoration:none;border-radius:10px;" />
                          </td>
                          <td style="vertical-align:middle;padding-left:12px;">
                            <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:#111;font-weight:800;letter-spacing:1px;">
                              ${esc(club).toUpperCase()}
                            </div>
                            <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:#6b7280;font-size:12px;margin-top:2px;">
                              Nueva reserva
                            </div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                <div style="height:14px"></div>

                <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:#111;font-size:18px;font-weight:800;">
                  Nueva reserva confirmada
                </div>

                <div style="height:14px"></div>

                <div style="border:1px solid #e9d5c7;border-radius:14px;padding:14px;background:#fff7f1;">
                  <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:#111;font-size:14px;line-height:1.6;">
                    <div><b>Cliente:</b> ${esc(a.customerName)}</div>
                    <div><b>Telefono:</b> ${esc(a.customerPhone)}</div>
                    ${a.customerEmail ? `<div><b>Correo:</b> ${esc(a.customerEmail)}</div>` : ""}
                  </div>
                </div>

                <div style="height:12px"></div>

                <div style="border:1px solid #e9d5c7;border-radius:14px;padding:14px;background:#fff7f1;">
                  <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:#111;font-size:14px;line-height:1.6;">
                    <div><b>Cancha:</b> ${esc(a.courtName)}</div>
                    <div><b>Fecha:</b> ${esc(a.dateLocal)}</div>
                    <div><b>Horario:</b> ${esc(a.startTimeLocal)} &ndash; ${esc(a.endTimeLocal)}</div>
                    <div style="margin-top:8px;"><b>Pago:</b> ${paidOnline ? `Pagado en linea ($${a.amountMXN} MXN)` : "En recepcion (pendiente)"}</div>
                  </div>
                </div>

                <div style="height:16px"></div>

                <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;font-size:12px;color:#9ca3af;">
                  &copy; ${new Date().getFullYear()} ${esc(club)}
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

/**
 * Recordatorio que se manda la tarde anterior a la reserva. Incluye un link
 * para avisar por WhatsApp si el cliente ya no puede ir, para liberar la
 * cancha a tiempo.
 */
export function buildBookingReminderEmail(a: {
  clubName?: string;
  logoUrl?: string;
  fullName: string;
  courtName: string;
  dateLocal: string;
  startTimeLocal: string;
  endTimeLocal: string;
  paid: boolean;
  whatsappPhone: string;
}) {
  const club = a.clubName ?? "Sacré Pádel";
  const logo = a.logoUrl ?? "https://sacrepadel.com/email/logo.png";
  const firstName = a.fullName.trim().split(/\s+/)[0] || "";
  const subject = `Recordatorio: tu reserva de mañana a las ${a.startTimeLocal} - ${club}`;

  const cancelText = `Hola, soy ${a.fullName.trim() || "un cliente"}. Tengo reserva en ${a.courtName} el ${a.dateLocal} a las ${a.startTimeLocal} y no voy a poder llegar. ¿Podrían liberar el horario? ¡Gracias!`;
  const cancelHref = `https://wa.me/${a.whatsappPhone}?text=${encodeURIComponent(cancelText)}`;
  const paymentLine = a.paid ? "Ya está pagada." : "El pago se hace en recepción al llegar.";

  const text = [
    `Hola${firstName ? ` ${firstName}` : ""},`,
    "",
    `Te recordamos tu reserva de mañana en ${club}:`,
    `Cancha: ${a.courtName}`,
    `Fecha: ${a.dateLocal}`,
    `Horario: ${a.startTimeLocal} - ${a.endTimeLocal}`,
    paymentLine,
    "",
    "Si ya no puedes venir, avísanos para dársela a alguien más:",
    cancelHref,
  ].join("\n");

  const font = "font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;";
  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f6efe9;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6efe9;padding:24px 0;">
      <tr>
        <td align="center" style="padding:0 12px;">
          <table role="presentation" width="520" cellspacing="0" cellpadding="0" style="width:520px;max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #f0e2d8;">
            <tr>
              <td style="padding:18px 20px;">
                <table role="presentation" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="vertical-align:middle;">
                      <img src="${esc(logo)}" width="40" height="40" alt="${esc(club)}" style="display:block;border:0;border-radius:10px;" />
                    </td>
                    <td style="vertical-align:middle;padding-left:12px;">
                      <div style="${font}color:#111;font-weight:800;letter-spacing:1px;">${esc(club).toUpperCase()}</div>
                      <div style="${font}color:#6b7280;font-size:12px;margin-top:2px;">Recordatorio de reserva</div>
                    </td>
                  </tr>
                </table>

                <div style="height:14px"></div>
                <div style="${font}color:#111;font-size:18px;font-weight:800;">¡Nos vemos mañana!</div>
                <div style="height:8px"></div>
                <div style="${font}color:#374151;font-size:14px;line-height:1.5;">
                  Hola${firstName ? ` <b>${esc(firstName)}</b>` : ""}, te recordamos tu reserva.
                </div>

                <div style="height:14px"></div>
                <div style="border:1px solid #e9d5c7;border-radius:14px;padding:14px;background:#fff7f1;">
                  <div style="${font}color:#111;font-size:14px;line-height:1.6;">
                    <div><b>Cancha:</b> ${esc(a.courtName)}</div>
                    <div><b>Fecha:</b> ${esc(a.dateLocal)}</div>
                    <div><b>Horario:</b> ${esc(a.startTimeLocal)} – ${esc(a.endTimeLocal)}</div>
                    <div style="margin-top:10px;">${esc(paymentLine)}</div>
                  </div>
                </div>

                <div style="height:16px"></div>
                <div style="${font}color:#374151;font-size:13px;line-height:1.5;">
                  ¿Ya no puedes venir? Un aviso nos ayuda a dársela a alguien que la está esperando.
                </div>
                <div style="height:10px"></div>
                <a href="${esc(cancelHref)}" style="${font}display:inline-block;background:#9a3b1b;color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;padding:10px 16px;border-radius:10px;">
                  Avisar por WhatsApp
                </a>

                <div style="height:16px"></div>
                <div style="${font}font-size:12px;color:#9ca3af;">© ${new Date().getFullYear()} ${esc(club)}</div>
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

/**
 * Aviso al cliente de que su reserva se canceló (por él o por el club), con
 * el estado del reembolso si había pagado en línea.
 */
export function buildCancellationEmail(a: {
  clubName?: string;
  fullName: string;
  courtName: string;
  dateLocal: string;
  startTimeLocal: string;
  endTimeLocal: string;
  cancelledBy: "CUSTOMER" | "RECEPTION";
  /** Monto reembolsado en línea; null si no había pago en línea. */
  refundedMXN: number | null;
  /** true si el reembolso automático falló y el club lo hará a mano. */
  refundPending?: boolean;
}) {
  const club = a.clubName ?? "Sacré Pádel";
  const subject = `Reserva cancelada - ${club}`;
  const who = a.cancelledBy === "CUSTOMER" ? "Cancelaste tu reserva" : "El club canceló tu reserva";
  const refundLine = a.refundPending
    ? "Tu reembolso está en proceso: el club lo hará manualmente y te avisará."
    : a.refundedMXN
      ? `Te devolvimos $${a.refundedMXN} MXN a tu método de pago. Según tu banco, puede tardar de 2 a 10 días hábiles en verse.`
      : "";

  const text = [
    `Hola ${a.fullName},`,
    "",
    `${who} en ${club}.`,
    `Cancha: ${a.courtName}`,
    `Fecha: ${a.dateLocal}`,
    `Horario: ${a.startTimeLocal} - ${a.endTimeLocal}`,
    refundLine ? "" : null,
    refundLine || null,
    "",
    "Cuando quieras, reserva otra vez en sacrepadel.com.",
  ]
    .filter((l) => l !== null)
    .join("\n");

  const font = "font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;";
  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f0e9;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f0e9;padding:24px 0;">
      <tr>
        <td align="center" style="padding:0 12px;">
          <table role="presentation" width="520" cellspacing="0" cellpadding="0" style="width:520px;max-width:520px;background:#ffffff;border:1px solid #ded6c9;">
            <tr>
              <td style="padding:22px 22px;">
                <div style="${font}color:#9A6A45;font-size:11px;letter-spacing:3px;text-transform:uppercase;">${esc(club)}</div>
                <div style="${font}color:#13110E;font-size:20px;font-weight:700;margin-top:10px;">${esc(who)}</div>
                <div style="${font}color:#374151;font-size:14px;line-height:1.6;margin-top:8px;">Hola <b>${esc(a.fullName)}</b>,</div>
                <div style="border-top:1px solid #ded6c9;border-bottom:1px solid #ded6c9;padding:12px 0;margin-top:14px;${font}color:#13110E;font-size:14px;line-height:1.7;">
                  <div><b>Cancha:</b> ${esc(a.courtName)}</div>
                  <div><b>Fecha:</b> ${esc(a.dateLocal)}</div>
                  <div><b>Horario:</b> ${esc(a.startTimeLocal)} – ${esc(a.endTimeLocal)}</div>
                </div>
                ${refundLine ? `<div style="${font}color:#374151;font-size:14px;line-height:1.6;margin-top:14px;">${esc(refundLine)}</div>` : ""}
                <div style="${font}color:#374151;font-size:14px;line-height:1.6;margin-top:14px;">Cuando quieras, <a href="https://sacrepadel.com/reservar" style="color:#9A6A45;font-weight:700;">reserva otra vez</a>.</div>
                <div style="${font}color:#9ca3af;font-size:12px;margin-top:18px;">© ${new Date().getFullYear()} ${esc(club)}</div>
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

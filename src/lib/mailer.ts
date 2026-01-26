type SendArgs = { to: string; subject: string; html: string; text?: string };

function env(name: string) {
  return (process.env[name] ?? "").trim();
}

export async function sendEmail(
  args: SendArgs
): Promise<{ ok: true } | { ok: false; error: string }> {
  const host = env("SMTP_HOST");
  const portStr = env("SMTP_PORT");
  const user = env("SMTP_USER");
  const pass = env("SMTP_PASS");
  const from = env("SMTP_FROM");
  const secure = env("SMTP_SECURE").toLowerCase() === "true";

  if (!host || !portStr || !user || !pass || !from) {
    return { ok: false, error: "Mailer no configurado (faltan variables SMTP en .env.local)" };
  }

  const port = Number(portStr);
  if (!Number.isFinite(port)) return { ok: false, error: "SMTP_PORT inválido" };

  try {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from,
      to: args.to,
      subject: args.subject,
      text: args.text,
      html: args.html,
    });

    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Error enviando correo" };
  }
}

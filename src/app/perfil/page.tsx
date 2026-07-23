"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";
import { normalizePhone as normalizePhoneLib } from "@/lib/phone";
import { User, Phone, Cake, Users, Trophy, MessageSquare, Check } from "lucide-react";

type ProfileRow = {
  id: string;
  full_name: string | null;
  phone_e164: string | null;
  birth_date: string | null;
  notes: string | null;
  sex: string | null;
  division: string | null;
};

function normalizePhoneForProfile(raw: string) {
  const input = (raw ?? "").trim();

  // Si lo dejan vacío, lo permitimos (teléfono opcional)
  if (!input) return { e164: null as string | null, isValid: true };

  // Usa tu helper real de lib/phone.ts
  const n = normalizePhoneLib(input, "MX");

  if (!n.isValid || !n.e164) {
    return { e164: null as string | null, isValid: false };
  }

  return { e164: n.e164, isValid: true };
}

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [playerNotes, setPlayerNotes] = useState("");
  const [sex, setSex] = useState("");
  const [division, setDivision] = useState("");

  // Presentational only — lets the phone field show its "formato inválido"
  // hint as soon as you leave the field instead of only after clicking
  // Guardar. Doesn't change what save() validates or submits.
  const [phoneTouched, setPhoneTouched] = useState(false);
  const phoneCheck = useMemo(() => normalizePhoneForProfile(phone), [phone]);
  const showPhoneError = phoneTouched && phone.trim() !== "" && !phoneCheck.isValid;

  const dobOk = Boolean(birthDate);
  const sexOk = Boolean(sex.trim());
  const canSave = dobOk && sexOk && !saving && !syncing;

  // Purely a friendly "you're almost done" nudge — not tied to canSave, just
  // counts how many of the six fields have something in them.
  const filledCount = [fullName, phone, birthDate, sex, division, playerNotes].filter(
    (v) => v.trim() !== ""
  ).length;
  const completionPct = Math.round((filledCount / 6) * 100);

  async function load() {
    setLoading(true);
    setError(null);
    setOkMsg(null);

    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      router.replace("/login?next=%2Fperfil");
      return;
    }

    const { data: profRaw, error: profErr } = await supabase
      .from("profiles")
      .select("id, full_name, phone_e164, birth_date, notes, sex, division")
      .eq("id", data.user.id)
      .maybeSingle();
    const prof = profRaw as ProfileRow | null;

    if (profErr) setError(profErr.message);

    setFullName(prof?.full_name ?? "");
    setPhone(prof?.phone_e164 ?? "");
    setBirthDate(prof?.birth_date ?? "");
    setPlayerNotes(prof?.notes ?? "");
    setSex(prof?.sex ?? "");
    setDivision(prof?.division ?? "");
    setLoading(false);
  }

  async function syncCustomerFromProfile() {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("No hay sesión activa. Inicia sesión de nuevo.");

    const r = await fetch("/api/customers/sync-profile", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    const bodyText = await r.text();
    if (!r.ok) {
      let msg = bodyText;
      try {
        const j = JSON.parse(bodyText);
        msg = j?.error ?? bodyText;
      } catch {}
      throw new Error(msg || `Error ${r.status}`);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    setOkMsg(null);

    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error("Sesión no válida. Inicia sesión de nuevo.");

      const phoneNorm = normalizePhoneForProfile(phone);
      if (!phoneNorm.isValid) {
        throw new Error("Teléfono inválido. Ej: 434 123 4567 o +52 434 123 4567");
      }

      // Requeridos para promos y analítica de comunidad
      if (!birthDate) {
        throw new Error("Por favor ingresa tu fecha de nacimiento (la usamos para promociones de cumpleaños).");
      }
      if (!sex.trim()) {
        throw new Error("Por favor selecciona tu sexo (nos ayuda a organizar eventos y ligas).");
      }

      const payload = {
        id: data.user.id,
        full_name: fullName.trim() || null,
        phone_e164: phoneNorm.e164,
        birth_date: birthDate,
        notes: playerNotes.trim() || null,
        sex: sex.trim(),
        division: division.trim() || null,
        updated_at: new Date().toISOString(),
      };

      const { error: upErr } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
      if (upErr) throw upErr;

      setOkMsg("Perfil guardado. Sincronizando con recepción…");
      setSyncing(true);
      await syncCustomerFromProfile();
      setOkMsg("¡Listo! Tu perfil está guardado y sincronizado.");
    } catch (e: any) {
      setError(e?.message ?? "Error guardando");
    } finally {
      setSyncing(false);
      setSaving(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return <div className="page page-gradient p-10">Cargando…</div>;
  }

  const labelClass =
    "flex items-center gap-1.5 text-xs font-medium text-[var(--muted)]";
  const iconClass = "h-3.5 w-3.5 text-[var(--brand)]";

  return (
    <div className="page page-gradient">
      <div className="mx-auto max-w-2xl px-6 py-10 sm:py-14">
        <div className="max-w-lg">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--brand)]">
            Tu cuenta
          </p>
          <h1 className="font-display mt-3 text-4xl leading-[1.05] sm:text-5xl">
            <span className="font-light italic">Completa</span>{" "}
            <span className="font-black">tu perfil.</span>
          </h1>
          <p className="section-subtitle mt-3">
            Dos minutos ahora, reservas más rápidas después. Tus datos se
            usan solo para tus reservas y promociones del club.
          </p>
        </div>

        {/* Completion nudge — purely cosmetic, doesn't gate saving */}
        <div className="mt-6 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[rgba(120,46,21,0.10)]">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,var(--brand-highlight),var(--brand))] transition-all duration-500"
              style={{ width: `${completionPct}%` }}
            />
          </div>
          <span className="shrink-0 text-xs font-medium text-[var(--muted)]">
            {completionPct}% completo
          </span>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSave) void save();
          }}
          className="mt-6 card"
        >
          {error && (
            <div className="mb-5 rounded-lg border border-red-500/25 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {/* Section: contacto */}
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[var(--brand)]">
            Datos de contacto
          </p>

          <div className="mt-4 space-y-4">
            <div>
              <label className={labelClass}>
                <User className={iconClass} />
                Nombre completo (apellidos incluidos)
              </label>
              <input
                className="input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
                placeholder="Ej. Rodrigo Leal García"
              />
            </div>

            <div>
              <label className={labelClass}>
                <Phone className={iconClass} />
                Teléfono
              </label>
              <input
                className="input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onBlur={() => setPhoneTouched(true)}
                autoComplete="tel"
                inputMode="tel"
                placeholder="Ej. 434 123 4567"
              />
              {showPhoneError ? (
                <div className="mt-1 text-xs text-red-700">
                  Ese número no se ve válido. Prueba con 10 dígitos o formato +52…
                </div>
              ) : (
                <div className="mt-1 text-xs text-[var(--muted)]">
                  Lo usamos para confirmar tus reservas.
                </div>
              )}
            </div>
          </div>

          <div className="my-6 border-t border-[rgba(120,46,21,0.10)]" />

          {/* Section: sobre ti */}
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[var(--brand)]">
            Sobre ti
          </p>

          <div className="mt-4 space-y-4">
            <div>
              <label className={labelClass}>
                <Cake className={iconClass} />
                Fecha de nacimiento <span className="text-[var(--brand)]">*</span>
              </label>
              <input
                className="input"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                required
              />
              <div className="mt-1 text-xs text-[var(--muted)]">
                La usamos para promociones de cumpleaños 🎉
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass}>
                  <Users className={iconClass} />
                  Sexo <span className="text-[var(--brand)]">*</span>
                </label>

                <select
                  className="input"
                  value={sex}
                  onChange={(e) => setSex(e.target.value)}
                  required
                >
                  <option value="" disabled>
                    Selecciona…
                  </option>
                  <option value="M">Masculino</option>
                  <option value="F">Femenino</option>
                  <option value="Otro">Otro</option>
                </select>
                <div className="mt-1 text-xs text-[var(--muted)]">
                  Para organizar eventos y ligas por categoría.
                </div>
              </div>

              <div>
                <label className={labelClass}>
                  <Trophy className={iconClass} />
                  División / Nivel (opcional)
                </label>
                <select
                  className="input"
                  value={division}
                  onChange={(e) => setDivision(e.target.value)}
                >
                  <option value="">Sin especificar</option>
                  <option value="1ra">1ra — Avanzado / Competitivo</option>
                  <option value="2da">2da — Avanzado</option>
                  <option value="3ra">3ra — Intermedio alto</option>
                  <option value="4ta">4ta — Intermedio</option>
                  <option value="5ta">5ta — Intermedio bajo</option>
                  <option value="6ta">6ta — Principiante</option>
                </select>
                <div className="mt-1 text-xs text-[var(--muted)]">
                  1ra es la categoría más avanzada; 6ta es para quienes están empezando.
                </div>
              </div>
            </div>

            <div>
              <label className={labelClass}>
                <MessageSquare className={iconClass} />
                Notas (opcional)
              </label>
              <textarea
                className="input"
                value={playerNotes}
                onChange={(e) => setPlayerNotes(e.target.value)}
                rows={4}
                placeholder="Lesiones, preferencias de horario, con quién sueles jugar…"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={!canSave}
            className="mt-7 w-full btn-primary py-3.5 text-base disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Guardando…" : syncing ? "Sincronizando…" : "Guardar perfil"}
          </button>

          {okMsg && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-50 p-3 text-sm text-emerald-800">
              <span className="animate-checkmark flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              </span>
              {okMsg}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";
import { normalizePhoneToE164 } from "@/lib/phone";


type ProfileRow = {
  id: string;
  full_name: string | null;
  phone_e164: string | null;
  birth_date: string | null;
  notes: string | null;
  sex: string | null;
  division: string | null;
};

function normalizePhone(raw: string) {
  const input = (raw || "").trim();
  if (!input) return { e164: null as string | null, isValid: true };

  // Acepta "434 123 4567" y también "+52 434 123 4567"
  const n = normalizePhoneToE164(input, "MX");
  if (!n.isValid || !n.e164) return { e164: null as string | null, isValid: false };

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

  async function load() {
    setLoading(true);
    setError(null);
    setOkMsg(null);

    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      router.replace("/login?next=%2Fperfil");
      return;
    }

    const { data: prof, error: profErr } = await supabase
      .from("profiles")
      .select("id, full_name, phone_e164, birth_date, notes, sex, division")
      .eq("id", data.user.id)
      .maybeSingle<ProfileRow>();

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

      const phoneNorm = normalizePhone(phone);
      if (!phoneNorm.isValid) {
        throw new Error("Teléfono inválido. Ej: 434 123 4567 o +52 434 123 4567");
      }


      const payload = {
        id: data.user.id,
        full_name: fullName.trim() || null,
        phone_e164: phoneNorm.e164,
        birth_date: birthDate || null,
        notes: playerNotes.trim() || null,
        sex: sex.trim() || null,
        division: division.trim() || null,
        updated_at: new Date().toISOString(),
      };

      const { error: upErr } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
      if (upErr) throw upErr;

      setOkMsg("Perfil guardado. Sincronizando con recepción…");
      setSyncing(true);
      await syncCustomerFromProfile();
      setOkMsg("Listo. Perfil sincronizado.");
    } catch (e: any) {
      setError(e?.message ?? "Error guardando");
    } finally {
      setSyncing(false);
      setSaving(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/");
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return <div className="page page-gradient p-10">Cargando…</div>;
  }

  return (
    <div className="page page-gradient">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="section-title">Mi perfil</h1>
            <p className="section-subtitle">Completa tus datos para reservar más rápido.</p>
          </div>

          <button onClick={signOut} className="btn-secondary">
            Cerrar sesión
          </button>
        </div>

        <div className="mt-6 card">
          {error && (
            <div className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
              {error}
            </div>
          )}
          {okMsg && (
            <div className="mb-4 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
              {okMsg}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs text-white/70">Nombre</label>
              <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>

            <div>
              <label className="block text-xs text-white/70">Teléfono</label>
              <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>

            <div>
              <label className="block text-xs text-white/70">Fecha de nacimiento (opcional)</label>
              <input className="input" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="block text-xs text-white/70">Sexo (opcional)</label>
                <select className="input" value={sex} onChange={(e) => setSex(e.target.value)}>
                  <option value="">—</option>
                  <option value="M">Masculino</option>
                  <option value="F">Femenino</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-white/70">División / Nivel (opcional)</label>
                <input
                  className="input"
                  value={division}
                  onChange={(e) => setDivision(e.target.value)}
                  placeholder="Ej. 4ta, 5ta, Intermedio…"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-white/70">Notas (opcional)</label>
              <textarea className="input" value={playerNotes} onChange={(e) => setPlayerNotes(e.target.value)} rows={4} />
            </div>

            <button onClick={save} disabled={saving || syncing} className="w-full btn-primary">
              {saving ? "Guardando…" : syncing ? "Sincronizando…" : "Guardar perfil"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

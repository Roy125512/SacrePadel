import { beforeAll, describe, expect, it, vi } from "vitest";

// Corre contra la base de datos en memoria del modo demo (src/lib/demo).
vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");

let resolveWebCustomer: typeof import("@/lib/customers").resolveWebCustomer;
let db: any;

beforeAll(async () => {
  ({ resolveWebCustomer } = await import("@/lib/customers"));
  ({ supabaseAdmin: db } = await import("@/lib/supabaseAdmin"));
});

async function getCustomer(id: string) {
  const { data } = await db.from("customers").select("*").eq("id", id).maybeSingle();
  return data;
}

function ok(r: { id: string } | { error: { message: string } }) {
  if ("error" in r) throw new Error(r.error.message);
  return r.id;
}

describe("resolveWebCustomer", () => {
  it("crea un cliente nuevo cuando no existe", async () => {
    const id = ok(await resolveWebCustomer({ full_name: "Ana Real", phone_e164: "+524430000001", email: "ana@x.com" }, null));
    const c = await getCustomer(id);
    expect(c.full_name).toBe("Ana Real");
    expect(c.email).toBe("ana@x.com");
    expect(c.user_id).toBeNull();
  });

  it("no deja que alguien con el mismo teléfono sobrescriba los datos (solo llena vacíos)", async () => {
    const id = ok(await resolveWebCustomer({ full_name: "Beto", phone_e164: "+524430000002", division: "4ta" }, null));

    const again = ok(
      await resolveWebCustomer(
        { full_name: "Impostor", phone_e164: "+524430000002", email: "evil@x.com", division: "1ra", sex: "M" },
        "user-intruso"
      )
    );

    expect(again).toBe(id);
    const c = await getCustomer(id);
    expect(c.full_name).toBe("Beto"); // no se sobrescribe
    expect(c.division).toBe("4ta"); // no se sobrescribe
    expect(c.email).toBe("evil@x.com"); // estaba vacío: se llena
    expect(c.sex).toBe("M"); // estaba vacío: se llena
    expect(c.user_id).toBeNull(); // no se "adueña" del registro
  });

  it("la cuenta dueña sí puede actualizar sus datos, sin borrar con vacíos", async () => {
    const id = ok(
      await resolveWebCustomer({ full_name: "Caro", phone_e164: "+524430000003", division: "5ta" }, "user-caro")
    );
    expect((await getCustomer(id)).user_id).toBe("user-caro");

    ok(await resolveWebCustomer({ full_name: "Carolina", phone_e164: "+524430000003", division: null }, "user-caro"));
    const c = await getCustomer(id);
    expect(c.full_name).toBe("Carolina");
    expect(c.division).toBe("5ta");
  });
});

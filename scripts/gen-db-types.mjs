#!/usr/bin/env node
// Genera src/lib/database.types.ts a partir del esquema que publica la API
// de Supabase (PostgREST /rest/v1/, formato OpenAPI). Mismo formato que
// `supabase gen types typescript`, pero sin necesitar la CLI ni una llave de
// cuenta: usa las variables de .env.local.
//
// Uso (después de aplicar una migración):
//   node --env-file=.env.local scripts/gen-db-types.mjs
// o, si ya tienes el JSON del esquema descargado:
//   node scripts/gen-db-types.mjs --from esquema.json

import { readFile, writeFile } from "node:fs/promises";

const OUT = "src/lib/database.types.ts";

// PostgREST no describe lo que regresan las funciones que devuelven una
// tabla (RETURNS TABLE): se declara aquí a mano.
const FUNCTION_RETURNS = {
  rate_limit_hit: "{ allowed: boolean; retry_after_seconds: number }[]",
};

async function loadSchema() {
  const fromIdx = process.argv.indexOf("--from");
  if (fromIdx !== -1) return JSON.parse(await readFile(process.argv[fromIdx + 1], "utf8"));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (usa --env-file=.env.local)");
  const r = await fetch(`${url}/rest/v1/`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/openapi+json" },
  });
  if (!r.ok) throw new Error(`No se pudo leer el esquema: HTTP ${r.status}`);
  return r.json();
}

function tsType(p) {
  if (p.enum) return p.enum.map((v) => JSON.stringify(v)).join(" | ");
  switch (p.type) {
    case "integer":
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "array":
      return `${tsType(p.items ?? {})}[]`;
    case "string":
      return "string";
    default:
      return "Json";
  }
}

function foreignKey(description) {
  const m = /<fk table='([^']+)' column='([^']+)'\/>/.exec(description ?? "");
  return m ? { table: m[1], column: m[2] } : null;
}

const schema = await loadSchema();
const tables = Object.keys(schema.definitions ?? {}).sort();

let out = `// ARCHIVO GENERADO — no editar a mano.
// Regenerar con: node --env-file=.env.local scripts/gen-db-types.mjs

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
`;

for (const t of tables) {
  const def = schema.definitions[t];
  const required = new Set(def.required ?? []);
  const cols = Object.entries(def.properties);

  const row = cols.map(([c, p]) => `          ${c}: ${tsType(p)}${required.has(c) ? "" : " | null"};`);
  const insert = cols.map(([c, p]) => {
    const optional = !required.has(c) || "default" in p;
    return `          ${c}${optional ? "?" : ""}: ${tsType(p)}${required.has(c) ? "" : " | null"};`;
  });
  const update = cols.map(([c, p]) => `          ${c}?: ${tsType(p)}${required.has(c) ? "" : " | null"};`);
  const rels = cols
    .map(([c, p]) => [c, foreignKey(p.description)])
    .filter(([, fk]) => fk)
    .map(
      ([c, fk]) => `          {
            foreignKeyName: "${t}_${c}_fkey";
            columns: ["${c}"];
            isOneToOne: false;
            referencedRelation: "${fk.table}";
            referencedColumns: ["${fk.column}"];
          },`
    );

  out += `      ${t}: {
        Row: {
${row.join("\n")}
        };
        Insert: {
${insert.join("\n")}
        };
        Update: {
${update.join("\n")}
        };
        Relationships: [${rels.length ? "\n" + rels.join("\n") + "\n        " : ""}];
      };
`;
}

out += `    };
    Views: { [_ in never]: never };
    Functions: {
`;

for (const [path, ops] of Object.entries(schema.paths ?? {})) {
  if (!path.startsWith("/rpc/")) continue;
  const name = path.slice(5);
  const body = (ops.post?.parameters ?? []).find((p) => p.in === "body")?.schema;
  const req = new Set(body?.required ?? []);
  const args = Object.entries(body?.properties ?? {}).map(
    ([a, p]) => `          ${a}${req.has(a) ? "" : "?"}: ${tsType(p)};`
  );
  out += `      ${name}: {
        Args: {
${args.join("\n")}
        };
        Returns: ${FUNCTION_RETURNS[name] ?? "Json"};
      };
`;
}

out += `    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

type PublicSchema = Database["public"];
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"];
`;

await writeFile(OUT, out);
console.log(`Tipos generados en ${OUT}: ${tables.length} tablas.`);

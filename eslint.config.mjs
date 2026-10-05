import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // El modo demo es una base de datos falsa genérica (cualquier tabla,
    // cualquier columna) y los tests arman filas a mano: ahí `any` es lo
    // honesto. En el resto del código los resultados de Supabase están
    // tipados con src/lib/database.types.ts.
    files: ["src/lib/demo/**", "src/**/__tests__/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;

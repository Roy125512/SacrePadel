import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    include: ["src/**/*.test.ts"],
    // Fija la zona horaria para que los tests no dependan de la máquina:
    // la lógica de negocio debe funcionar igual con el servidor en UTC.
    env: { TZ: "UTC" },
  },
});

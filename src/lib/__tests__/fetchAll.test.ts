import { describe, expect, it } from "vitest";
import { fetchAllRows } from "@/lib/fetchAll";

function fakeTable(total: number) {
  const rows = Array.from({ length: total }, (_, i) => ({ id: i }));
  const calls: Array<[number, number]> = [];
  const build = (from: number, to: number) => {
    calls.push([from, to]);
    return Promise.resolve({ data: rows.slice(from, to + 1), error: null });
  };
  return { build, calls };
}

describe("fetchAllRows", () => {
  it("trae más de 1000 filas pidiendo varias páginas", async () => {
    const t = fakeTable(2500);
    const res = await fetchAllRows(t.build);
    expect(res.error).toBeNull();
    expect(res.data).toHaveLength(2500);
    expect(t.calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it("hace una consulta extra vacía cuando el total es múltiplo exacto de 1000", async () => {
    const t = fakeTable(1000);
    const res = await fetchAllRows(t.build);
    expect(res.data).toHaveLength(1000);
    expect(t.calls).toHaveLength(2);
  });

  it("regresa el error de la base de datos", async () => {
    const res = await fetchAllRows(() => Promise.resolve({ data: null, error: { message: "boom" } }));
    expect(res.error?.message).toBe("boom");
  });
});

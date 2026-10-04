// Supabase (PostgREST) regresa como máximo 1000 filas por consulta y corta
// el resto SIN avisar. Para reportes que pueden pasar de eso (rangos largos,
// meses llenos) hay que pedir página por página.

const PAGE_SIZE = 1000;

type PageResult<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/**
 * Trae todas las filas de una consulta, en páginas de 1000.
 * `build` debe crear la consulta desde cero en cada llamada (un query
 * builder de supabase-js solo se puede ejecutar una vez) y debe incluir un
 * .order() estable para que las páginas no se encimen.
 */
export async function fetchAllRows<T>(
  build: (from: number, to: number) => PageResult<T>
): Promise<{ data: T[]; error: { message: string } | null }> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build(from, from + PAGE_SIZE - 1);
    if (error) return { data: all, error };
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) return { data: all, error: null };
  }
}

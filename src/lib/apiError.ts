import { NextResponse } from "next/server";

const GENERIC_MESSAGE = "Ocurrió un error interno. Intenta de nuevo en unos momentos.";

export function dbErrorResponse(
  context: string,
  error: unknown,
  status = 500
) {
  console.error(context, error);
  return NextResponse.json({ error: GENERIC_MESSAGE }, { status });
}

/** Llamada JSON a la API propia; lanza Error con el mensaje del servidor. */
export async function enviar<T = Record<string, unknown>>(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<T> {
  const r = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error ?? "No se pudo completar la acción.");
  return data as T;
}

/** Peso chileno sin decimales, igual en servidor y navegador. */
export const clp = (n: number) =>
  `$${Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;

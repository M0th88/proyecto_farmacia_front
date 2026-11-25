import Link from "next/link";
import { requirePharmacyUser } from "@/lib/auth/session";
import { prismaPrivada } from "@/lib/db/prisma-privada";
import { mediosPago } from "@/lib/types/punto-de-venta";
import { fechaVenta, pesos } from "@/lib/validation/punto-de-venta";

export const instant = false;

export default async function HistorialPage({
  searchParams,
}: {
  searchParams: Promise<{ venta?: string | string[] }>;
}) {
  await requirePharmacyUser("privada");
  const { venta } = await searchParams;
  const busqueda = typeof venta === "string" ? venta.trim() : "";
  const id = Number(busqueda);
  const valida = /^\d{1,10}$/.test(busqueda) && id > 0 && id <= 2_147_483_647;
  const ventas =
    busqueda && !valida
      ? []
      : await prismaPrivada.venta.findMany({
          where: valida ? { id } : undefined,
          take: 100,
          orderBy: [{ creadaEn: "desc" }, { id: "desc" }],
          include: {
            detalles: {
              include: {
                medicamento: { select: { nombre: true } },
                lote: { select: { numeroLote: true } },
              },
            },
          },
        });
  const total = ventas.reduce((n, v) => n + Number(v.total), 0);
  return (
    <section className="pos-shell">
      <header className="pos-header">
        <div>
          <h1>Historial de ventas</h1>
          <p>
            <Link href="/privada/punto-de-venta">Ir al POS</Link>
          </p>
        </div>
      </header>
      <div className="pos-grid">
        <section className="pos-panel">
          <div className="pos-title">
            <h2>
              {busqueda ? "Resultado de búsqueda" : "Últimas 100 operaciones"}
            </h2>
            <span>{ventas.length} ventas</span>
          </div>
          <form
            className="pos-filters pos-buscar-venta"
            action="/privada/historial"
          >
            <label>
              Número de venta
              <input
                name="venta"
                defaultValue={busqueda}
                inputMode="numeric"
                maxLength={10}
              />
            </label>
            <button type="submit">Buscar</button>
            {busqueda && (
              <Link href="/privada/historial">Limpiar búsqueda</Link>
            )}
          </form>
          {ventas.length ? (
            ventas.map((v) => (
              <details className="pos-sale" key={v.id}>
                <summary>
                  <b>Venta #{v.id}</b>
                  <span>{fechaVenta(v.creadaEn)}</span>
                  <span>{mediosPago[v.metodoPago]}</span>
                  <strong>{pesos(Number(v.total))}</strong>
                </summary>
                <div>
                  {v.detalles.map((d) => (
                    <p key={d.id}>
                      {d.cantidad} × {d.nombreProducto ?? d.medicamento.nombre}{" "}
                      · Lote {d.lote.numeroLote} · {pesos(Number(d.subtotal))}
                    </p>
                  ))}
                  <Link
                    className="pos-action-link"
                    href={`/privada/historial/${v.id}`}
                  >
                    Ver venta e imprimir documento
                  </Link>
                </div>
              </details>
            ))
          ) : (
            <p className="pos-empty" role="status">
              {busqueda
                ? valida
                  ? "Venta no encontrada."
                  : "Ingresa un número de venta válido."
                : "Todavía no hay ventas registradas."}
            </p>
          )}
        </section>
        <aside className="pos-panel">
          <div className="pos-title">
            <h2>Resumen visible</h2>
          </div>
          <div className="pos-total">
            <span>Ventas listadas</span>
            <strong>{ventas.length}</strong>
          </div>
          <div className="pos-total">
            <span>Total de estas ventas</span>
            <strong>{pesos(total)}</strong>
          </div>
        </aside>
      </div>
    </section>
  );
}

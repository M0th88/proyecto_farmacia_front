import Link from "next/link";
import { prismaPrivada } from "@/lib/db/prisma-privada";
import { mediosPago } from "@/lib/types/punto-de-venta";
import { fechaVenta, pesos } from "@/lib/validation/punto-de-venta";
import styles from "./operaciones-recientes.module.css";

const maxOperaciones = 100;
const historialHref = "/privada/historial-y-reportes";
const operacionesHref = `${historialHref}#operaciones-recientes`;

export async function getRecentOperations(busqueda: string) {
  const id = Number(busqueda);
  if (
    busqueda &&
    (!/^\d{1,10}$/.test(busqueda) || id < 1 || id > 2_147_483_647)
  ) {
    return { ventas: [], busquedaValida: false };
  }

  const ventas = await prismaPrivada.venta.findMany({
    where: busqueda ? { id } : undefined,
    take: maxOperaciones,
    orderBy: [{ creadaEn: "desc" }, { id: "desc" }],
    select: {
      id: true,
      creadaEn: true,
      metodoPago: true,
      total: true,
      detalles: {
        select: {
          id: true,
          cantidad: true,
          nombreProducto: true,
          subtotal: true,
          medicamento: { select: { nombre: true } },
          lote: { select: { numeroLote: true } },
        },
      },
    },
  });
  return { ventas, busquedaValida: true };
}

export function OperacionesRecientes({
  resultado: { ventas, busquedaValida },
  busqueda,
}: {
  resultado: Awaited<ReturnType<typeof getRecentOperations>>;
  busqueda: string;
}) {
  const total = ventas.reduce((n, v) => n + Number(v.total), 0);
  return (
    <div className={`pos-grid ${styles.operations}`} id="operaciones-recientes">
      <section className="pos-panel">
        <div className="pos-title">
          <h2>
            {busqueda ? "Resultado de búsqueda" : "Operaciones recientes"}
          </h2>
          <span>{ventas.length} ventas</span>
        </div>
        {!busqueda && (
          <p className={styles.description}>
            Últimas {maxOperaciones} operaciones registradas · Registro interno.
          </p>
        )}
        <form className="pos-filters pos-buscar-venta" action={operacionesHref}>
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
          {busqueda && <Link href={operacionesHref}>Limpiar búsqueda</Link>}
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
                    {d.cantidad} × {d.nombreProducto ?? d.medicamento.nombre} ·
                    Lote {d.lote.numeroLote} · {pesos(Number(d.subtotal))}
                  </p>
                ))}
                <Link
                  className="pos-action-link"
                  href={`${historialHref}/${v.id}`}
                >
                  Ver venta e imprimir documento
                </Link>
              </div>
            </details>
          ))
        ) : (
          <p className="pos-empty" role="status">
            {busqueda
              ? busquedaValida
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
        <p className="pos-footnote">
          Este resumen no sustituye la conciliación de caja ni los documentos
          del SII.
        </p>
      </aside>
    </div>
  );
}

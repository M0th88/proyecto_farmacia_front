import Link from "next/link";
import type { Pharmacy } from "@/lib/auth/pharmacies";
import type { PharmacyDb } from "@/lib/db/pharmacy-db";
import { mediosPago } from "@/lib/types/punto-de-venta";
import { pesos } from "./format";
import styles from "./operaciones-recientes.module.css";

const maxOperaciones = 100;
const fechaOperacion = new Intl.DateTimeFormat("es-CL", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Santiago",
});

export async function getRecentOperations(busqueda: string, db: PharmacyDb) {
  const id = Number(busqueda);
  const valida = /^\d{1,10}$/.test(busqueda) && id > 0 && id <= 2_147_483_647;
  if (busqueda && !valida) return [];
  return db.venta.findMany({
    where: valida ? { id } : undefined,
    take: maxOperaciones,
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
}

export function OperacionesRecientes({
  ventas,
  busqueda,
  pharmacy,
}: {
  busqueda: string;
  pharmacy: Pharmacy;
  ventas: Awaited<ReturnType<typeof getRecentOperations>>;
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
        <p className={styles.description}>
          Últimas {maxOperaciones} operaciones registradas · Registro interno,
          no boleta tributaria.
        </p>
        <form
          className="pos-filters pos-buscar-venta"
          action={`/${pharmacy}/historial-y-reportes#operaciones-recientes`}
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
            <Link
              href={`/${pharmacy}/historial-y-reportes#operaciones-recientes`}
            >
              Limpiar búsqueda
            </Link>
          )}
        </form>
        {ventas.length ? (
          ventas.map((v) => (
            <details className="pos-sale" key={v.id}>
              <summary>
                <b>Venta #{v.id}</b>
                <span>{fechaOperacion.format(v.creadaEn)}</span>
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
                  href={`/${pharmacy}/historial-y-reportes/${v.id}`}
                >
                  Ver venta e imprimir documento
                </Link>
              </div>
            </details>
          ))
        ) : (
          <p className="pos-empty" role="status">
            {busqueda
              ? "No hay ventas que coincidan con ese número."
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

import { prismaPrivada } from "@/lib/db/prisma-privada";
import { pesos } from "./format";
import styles from "./operaciones-recientes.module.css";

const maxOperaciones = 100;
const fechaOperacion = new Intl.DateTimeFormat("es-CL", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Santiago",
});

export function getRecentOperations() {
  return prismaPrivada.venta.findMany({
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
}: {
  ventas: Awaited<ReturnType<typeof getRecentOperations>>;
}) {
  const total = ventas
    .filter((v) => v.estado === "CONFIRMADA")
    .reduce((n, v) => n + Number(v.total), 0);
  return (
    <div className={`pos-grid ${styles.operations}`} id="operaciones-recientes">
      <section className="pos-panel">
        <div className="pos-title">
          <h2>Operaciones recientes</h2>
          <span>{ventas.length} ventas</span>
        </div>
        <p className={styles.description}>
          Últimas {maxOperaciones} operaciones registradas · Registro interno,
          no boleta tributaria.
        </p>
        {ventas.length ? (
          ventas.map((v) => (
            <details className="pos-sale" key={v.id}>
              <summary>
                <b>
                  {v.tipoOperacion} #{v.id} · {v.estado}
                </b>
                <span>{fechaOperacion.format(v.creadaEn)}</span>
                <span>{v.metodoPago.replaceAll("_", " ")}</span>
                <strong>{pesos(Number(v.total))}</strong>
              </summary>
              <div>
                <p>
                  Operador #{v.usuarioId ?? "histórico"} · Sucursal #
                  {v.sucursalId ?? "sin dato"}
                </p>
                {v.estado === "ANULADA" && (
                  <p>
                    Anulada por #{v.anuladaPor}: {v.motivoAnulacion}. No implica
                    devolución física.
                  </p>
                )}
                {v.detalles.map((d) => (
                  <p key={d.id}>
                    {d.cantidad} × {d.medicamento.nombre} · Lote{" "}
                    {d.lote.numeroLote} · {pesos(Number(d.subtotal))}
                    {" · "}Detalle #{d.id} · Ubicación #
                    {d.ubicacionId ?? "histórica"}
                  </p>
                ))}
              </div>
            </details>
          ))
        ) : (
          <p className="pos-empty">Todavía no hay ventas registradas.</p>
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

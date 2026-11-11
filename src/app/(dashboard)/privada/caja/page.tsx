import Link from "next/link";
import { connection } from "next/server";
import { requirePharmacyUser } from "@/lib/auth/session";
import { prismaPrivada } from "@/lib/db/prisma-privada";

export const instant = false;
const pesos = (n: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(n);
const diaChile = (fecha: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(fecha);

export default async function CajaPage() {
  await requirePharmacyUser("privada");
  await connection();
  const ahora = new Date();
  const hoy = diaChile(ahora);
  const ventas = (
    await prismaPrivada.venta.findMany({
      where: {
        creadaEn: { gte: new Date(ahora.getTime() - 48 * 60 * 60 * 1000) },
      },
      orderBy: { creadaEn: "desc" },
    })
  ).filter((v) => diaChile(v.creadaEn) === hoy);
  const metodos = ["EFECTIVO", "DEBITO", "CREDITO", "TRANSFERENCIA"] as const;
  const sumas = metodos.map((m) => ({
    metodo: m,
    total: ventas
      .filter((v) => v.metodoPago === m)
      .reduce((n, v) => n + Number(v.total), 0),
    cantidad: ventas.filter((v) => v.metodoPago === m).length,
  }));
  const total = sumas.reduce((n, m) => n + m.total, 0);
  return (
    <section className="pos-shell">
      <header className="pos-header">
        <div>
          <Link href="/">← Panel principal</Link>
          <p>FARMACIA PRIVADA / CAJA</p>
          <h1>Caja del día</h1>
          <span>Resumen de las ventas internas registradas hoy en Chile.</span>
        </div>
      </header>
      <div className="pos-metrics">
        <div>
          <small>Ventas hoy</small>
          <strong>{pesos(total)}</strong>
        </div>
        <div>
          <small>Tickets</small>
          <strong>{ventas.length}</strong>
        </div>
        <div>
          <small>Ticket promedio</small>
          <strong>{pesos(ventas.length ? total / ventas.length : 0)}</strong>
        </div>
        <div>
          <small>Fecha</small>
          <strong>{hoy}</strong>
        </div>
      </div>
      <div className="pos-grid">
        <section className="pos-panel">
          <div className="pos-title">
            <div>
              <small>MEDIOS DE PAGO</small>
              <h2>Distribución de cobros</h2>
            </div>
          </div>
          {sumas.map((m) => (
            <div className="pos-total" key={m.metodo}>
              <span>
                {m.metodo.replaceAll("_", " ")} · {m.cantidad} ventas
              </span>
              <strong>{pesos(m.total)}</strong>
            </div>
          ))}
        </section>
        <aside className="pos-panel">
          <div className="pos-title">
            <div>
              <small>CONTROL DE TURNO</small>
              <h2>Arqueo pendiente</h2>
            </div>
          </div>
          <p className="pos-footnote">
            Esta vista resume ventas registradas. La apertura, cierre, efectivo
            inicial, retiros y conciliación con terminal de pago se incorporarán
            cuando exista usuario y turno de caja.
          </p>
          <Link className="pos-action-link" href="/privada/historial">
            Ver historial de ventas →
          </Link>
        </aside>
      </div>
    </section>
  );
}

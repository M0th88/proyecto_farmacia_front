import Link from "next/link";
import { connection } from "next/server";
import { requirePharmacySection } from "@/lib/auth/pharmacy-permissions";
import {
  type PharmacyParams,
  resolvePharmacy,
} from "@/lib/auth/pharmacy-scope";
import { pharmacyDb } from "@/lib/db/pharmacy-db";
import { roleHasPermission } from "@/lib/private/permissions";

import { mediosPago } from "@/lib/types/punto-de-venta";
import { pesos } from "@/lib/validation/punto-de-venta";
import { ControlesDeCaja } from "./_components/controles-de-caja";

export const instant = false;
const diaChile = (fecha: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(fecha);

export default async function CajaDelDiaPage({ params }: PharmacyParams) {
  const pharmacy = await resolvePharmacy(params);
  const user = await requirePharmacySection(pharmacy, "/caja-del-dia");
  const puedeUsarPos = roleHasPermission(user.rol, "pos");
  const puedeVerHistorial = roleHasPermission(user.rol, "ventas");
  await connection();
  const ahora = new Date();
  const hoy = diaChile(ahora);
  const ventas = (
    await pharmacyDb(pharmacy).venta.findMany({
      where: {
        creadaEn: { gte: new Date(ahora.getTime() - 48 * 60 * 60 * 1000) },
      },
      select: { creadaEn: true, metodoPago: true, total: true },
    })
  ).filter((v) => diaChile(v.creadaEn) === hoy);
  const metodos = Object.keys(mediosPago) as (keyof typeof mediosPago)[];
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
          <h1>Caja del Día</h1>
          <span>Resumen de las ventas internas registradas hoy en Chile.</span>
          {(puedeUsarPos || puedeVerHistorial) && (
            <p>
              {puedeUsarPos && (
                <Link href={`/${pharmacy}/punto-de-venta`}>Ir al POS</Link>
              )}
              {puedeVerHistorial && (
                <Link
                  href={`/${pharmacy}/historial-y-reportes#operaciones-recientes`}
                >
                  Historial de ventas
                </Link>
              )}
            </p>
          )}
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
                {mediosPago[m.metodo]} · {m.cantidad} ventas
              </span>
              <strong>{pesos(m.total)}</strong>
            </div>
          ))}
        </section>
        <ControlesDeCaja />
      </div>
    </section>
  );
}

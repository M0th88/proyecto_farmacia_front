import { connection } from "next/server";
import {
  type PharmacyParams,
  resolvePharmacy,
} from "@/lib/auth/pharmacy-scope";
import { requirePharmacyUser } from "@/lib/auth/session";
import { panelDay } from "@/lib/dashboard-summary";
import { pharmacyDb } from "@/lib/db/pharmacy-db";
import { rangoReporte, TIPOS_REPORTE } from "@/lib/private/reportes";
import { pesos } from "@/lib/validation/punto-de-venta";
import { ExportarReportes } from "./_components/exportar-reportes";
import {
  getRecentOperations,
  OperacionesRecientes,
} from "./_components/operaciones-recientes";

export const instant = false;
const diaChile = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);

export default async function HistorialYReportesPage({
  params,
  searchParams,
}: PharmacyParams & {
  searchParams: Promise<{ venta?: string | string[] }>;
}) {
  const pharmacy = await resolvePharmacy(params);
  const user = await requirePharmacyUser(pharmacy);
  await connection();
  const { venta } = await searchParams;
  const busqueda = typeof venta === "string" ? venta.trim() : "";
  const ahora = new Date();
  const [ventas, operacionesRecientes] = await Promise.all([
    pharmacyDb(pharmacy).venta.findMany({
      where: {
        ...(pharmacy === "privada" ? { estado: "CONFIRMADA" } : {}),
        creadaEn: { gte: new Date(ahora.getTime() - 15 * 24 * 60 * 60 * 1000) },
      },
      select: { creadaEn: true, total: true },
    }),
    getRecentOperations(busqueda, pharmacy),
  ]);
  const hoy = diaChile(ahora);
  const dias = Array.from({ length: 14 }, (_, i) => {
    const clave = panelDay(hoy, i - 13);
    const delDia = ventas.filter((v) => diaChile(v.creadaEn) === clave);
    return {
      clave,
      total: delDia.reduce((n, v) => n + Number(v.total), 0),
      tickets: delDia.length,
    };
  });
  const total = dias.reduce((n, d) => n + d.total, 0);
  const tickets = dias.reduce((n, d) => n + d.tickets, 0);
  const max = Math.max(1, ...dias.map((d) => d.total));
  const esAdmin = user.rol.nombre === "Administrador";
  const opcionesReporte = Object.entries(TIPOS_REPORTE)
    .filter(
      ([, r]) =>
        esAdmin || r.permisos.some((p) => user.rol.permisos.includes(p)),
    )
    .map(([tipo, r]) => ({ tipo, titulo: r.titulo, usaFechas: r.usaFechas }));
  const rangoInicial = rangoReporte();
  return (
    <section className="pos-shell">
      <header className="pos-header">
        <div>
          <h1>Historial y Reportes</h1>
          <span>Ventas registradas durante los últimos 14 días en Chile.</span>
        </div>
      </header>
      <div className="pos-metrics">
        <div>
          <small>Ventas 14 días</small>
          <strong>{pesos(total)}</strong>
        </div>
        <div>
          <small>Tickets</small>
          <strong>{tickets}</strong>
        </div>
        <div>
          <small>Ticket promedio</small>
          <strong>{pesos(tickets ? total / tickets : 0)}</strong>
        </div>
        <div>
          <small>Días con ventas</small>
          <strong>{dias.filter((d) => d.tickets > 0).length}</strong>
        </div>
      </div>
      {opcionesReporte.length > 0 && !("error" in rangoInicial) && (
        <ExportarReportes
          pharmacy={pharmacy}
          opciones={opcionesReporte}
          desdeInicial={rangoInicial.desde}
          hastaInicial={rangoInicial.hasta}
        />
      )}
      <OperacionesRecientes
        pharmacy={pharmacy}
        resultado={operacionesRecientes}
        busqueda={busqueda}
      />
      <section className="pos-panel">
        <div className="pos-title">
          <div>
            <small>TENDENCIA</small>
            <h2>Ventas por día</h2>
          </div>
        </div>
        <div className="indicator-chart">
          {dias.map((d) => (
            <div
              className="indicator-day"
              key={d.clave}
              title={`${d.clave}: ${pesos(d.total)} · ${d.tickets} tickets`}
            >
              <span>{d.total ? pesos(d.total) : "—"}</span>
              <div>
                <i
                  style={{ height: `${Math.max(4, (d.total / max) * 100)}%` }}
                />
              </div>
              <small>{d.clave.slice(5)}</small>
            </div>
          ))}
        </div>
        <p className="pos-footnote">
          Cifras internas del POS. Los márgenes requieren registrar costos de
          compra; no se estiman aquí.
        </p>
      </section>
    </section>
  );
}

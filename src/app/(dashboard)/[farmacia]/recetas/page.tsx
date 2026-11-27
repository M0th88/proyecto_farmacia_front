import Link from "next/link";
import { connection } from "next/server";
import {
  type PharmacyParams,
  resolvePharmacy,
} from "@/lib/auth/pharmacy-scope";
import { requirePharmacyUser } from "@/lib/auth/session";
import { prismaPrivada } from "@/lib/db/prisma-privada";
import { etiquetaTipoReceta, hoyChile } from "@/lib/validation/recetas";
import styles from "./recetas.module.css";

export const instant = false;
const fecha = new Intl.DateTimeFormat("es-CL", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Santiago",
});
const dia = (d: Date) => d.toISOString().slice(0, 10);

export default async function RecetasPage({
  params,
  searchParams,
}: PharmacyParams & { searchParams: Promise<{ q?: string; tipo?: string }> }) {
  const pharmacy = await resolvePharmacy(params);
  const user = await requirePharmacyUser(pharmacy);
  if (pharmacy !== "privada")
    return (
      <section className="pos-shell">
        <header className="pos-header">
          <div>
            <h1>Recetas</h1>
            <span>
              Disponible en Farmacia Privada. Las recetas de la red pública se
              gestionarán en el módulo de dispensación asistencial.
            </span>
          </div>
        </header>
      </section>
    );
  if (
    user.rol.nombre !== "Administrador" &&
    !["recetas", "controlados", "pos"].some((p) =>
      user.rol.permisos.includes(p),
    )
  )
    return (
      <section className="pos-shell">
        <p className="pos-empty" role="alert">
          Tu rol no tiene acceso al historial de recetas.
        </p>
      </section>
    );
  await connection();
  const { q = "", tipo = "" } = await searchParams;
  const busqueda = q.trim().slice(0, 40);
  const tipoFiltro = ["SIMPLE", "RETENIDA", "CHEQUE"].includes(tipo)
    ? (tipo as "SIMPLE" | "RETENIDA" | "CHEQUE")
    : undefined;
  const [recetas, conteo] = await Promise.all([
    prismaPrivada.receta.findMany({
      where: {
        tipo: tipoFiltro,
        ...(busqueda && {
          OR: [
            { pacienteRut: { contains: busqueda, mode: "insensitive" } },
            { pacienteNombre: { contains: busqueda, mode: "insensitive" } },
            { medicoRut: { contains: busqueda, mode: "insensitive" } },
            { medicoNombre: { contains: busqueda, mode: "insensitive" } },
            { folio: { contains: busqueda, mode: "insensitive" } },
          ],
        }),
      },
      orderBy: { id: "desc" },
      take: 200,
      include: {
        detalles: {
          select: {
            cantidad: true,
            nombreProducto: true,
            medicamento: { select: { nombre: true } },
          },
        },
      },
    }),
    prismaPrivada.receta.groupBy({ by: ["tipo"], _count: true }),
  ]);
  const total = (t: string) => conteo.find((c) => c.tipo === t)?._count ?? 0;
  const hoy = hoyChile();

  return (
    <section className="pos-shell">
      <header className="pos-header">
        <div>
          <h1>Recetas</h1>
          <span>
            Recetas presentadas en el POS: validación por RUT del paciente,
            médico emisor y vigencia.
          </span>
        </div>
      </header>
      <div className="pos-metrics">
        <div>
          <small>Simples</small>
          <strong>{total("SIMPLE")}</strong>
        </div>
        <div>
          <small>Retenidas</small>
          <strong>{total("RETENIDA")}</strong>
        </div>
        <div>
          <small>Cheque</small>
          <strong>{total("CHEQUE")}</strong>
        </div>
        <div>
          <small>Total registradas</small>
          <strong>{conteo.reduce((n, c) => n + c._count, 0)}</strong>
        </div>
      </div>
      <section className="pos-panel">
        <form className={styles.filtros} action="/privada/recetas">
          <label>
            Buscar por RUT, nombre o folio
            <input name="q" defaultValue={busqueda} maxLength={40} />
          </label>
          <label>
            Tipo
            <select name="tipo" defaultValue={tipoFiltro ?? ""}>
              <option value="">Todas</option>
              <option value="SIMPLE">Simple</option>
              <option value="RETENIDA">Retenida</option>
              <option value="CHEQUE">Cheque</option>
            </select>
          </label>
          <button type="submit">Buscar</button>
          {(busqueda || tipoFiltro) && (
            <Link href="/privada/recetas">Limpiar</Link>
          )}
        </form>
        {recetas.length ? (
          <div className={styles.scroll}>
            <table className={styles.tabla}>
              <thead>
                <tr>
                  <th>Registro</th>
                  <th>Tipo</th>
                  <th>Folio</th>
                  <th>Paciente</th>
                  <th>Médico</th>
                  <th>Emisión</th>
                  <th>Vigencia</th>
                  <th>Productos</th>
                  <th>Venta</th>
                </tr>
              </thead>
              <tbody>
                {recetas.map((r) => (
                  <tr key={r.id}>
                    <td>{fecha.format(r.creadaEn)}</td>
                    <td>
                      {etiquetaTipoReceta[r.tipo]}
                      <small>
                        {r.origen === "DIGITAL" ? "Digital" : "Física"}
                      </small>
                    </td>
                    <td>{r.folio ?? "—"}</td>
                    <td>
                      {r.pacienteNombre}
                      <small>{r.pacienteRut}</small>
                    </td>
                    <td>
                      {r.medicoNombre}
                      <small>{r.medicoRut}</small>
                    </td>
                    <td>{dia(r.fechaEmision)}</td>
                    <td>
                      {dia(r.vigenteHasta)}
                      {dia(r.vigenteHasta) < hoy && (
                        <small className={styles.vencida}>Vencida</small>
                      )}
                    </td>
                    <td>
                      {r.detalles.map((d, i) => (
                        <small key={i}>
                          {d.cantidad} ×{" "}
                          {d.nombreProducto ?? d.medicamento.nombre}
                        </small>
                      ))}
                    </td>
                    <td>
                      {r.ventaId ? (
                        <Link
                          href={`/privada/historial-y-reportes/${r.ventaId}`}
                        >
                          #{r.ventaId}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="pos-empty">
            {busqueda || tipoFiltro
              ? "No hay recetas que coincidan con la búsqueda."
              : "Todavía no se han registrado recetas. Se crean al vender productos con receta en el POS."}
          </p>
        )}
        <p className="pos-footnote">Se muestran las últimas 200 recetas.</p>
      </section>
    </section>
  );
}

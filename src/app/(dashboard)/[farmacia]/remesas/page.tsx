import { connection } from "next/server";
import {
  type PharmacyParams,
  resolvePharmacy,
} from "@/lib/auth/pharmacy-scope";
import { requirePharmacyUser } from "@/lib/auth/session";
import { prismaAsistencial as db } from "@/lib/db/prisma-asistencial";
import { canOperate } from "@/lib/fefo";
import { SinPermiso, SoloAsistencial } from "../_components/solo-asistencial";
import styles from "../dispensacion/_components/dispensacion.module.css";
import { NuevaRemesa } from "./_components/nueva-remesa";

export const instant = false;
const fecha = new Intl.DateTimeFormat("es-CL", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Santiago",
});

export default async function RemesasPage({ params }: PharmacyParams) {
  const pharmacy = await resolvePharmacy(params);
  const user = await requirePharmacyUser(pharmacy);
  if (pharmacy !== "asistencial")
    return <SoloAsistencial titulo="Remesas CENABAST" />;
  if (!canOperate(user, "inventario"))
    return <SinPermiso texto="Tu rol no puede recibir remesas." />;
  await connection();
  const [remesas, medicamentos, ubicaciones] = await Promise.all([
    db.remesa.findMany({
      orderBy: { recibidaEn: "desc" },
      take: 50,
      include: {
        detalles: {
          include: {
            lote: {
              select: {
                numeroLote: true,
                fechaVencimiento: true,
                medicamento: { select: { nombre: true } },
              },
            },
          },
        },
      },
    }),
    db.medicamento.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, concentracion: true },
    }),
    db.ubicacionInventario.findMany({
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, tipo: true },
    }),
  ]);
  return (
    <section className="pos-shell">
      <header className="pos-header">
        <div>
          <h1>Remesas CENABAST</h1>
          <span>
            Recepción de medicamentos de la Central de Abastecimiento: cada lote
            entra al stock con su vencimiento para la salida FEFO.
          </span>
        </div>
      </header>
      <NuevaRemesa
        medicamentos={medicamentos.map((m) => ({
          id: m.id,
          nombre: m.concentracion
            ? `${m.nombre} · ${m.concentracion}`
            : m.nombre,
        }))}
        ubicaciones={ubicaciones.map((u) => ({
          id: u.id,
          nombre: `${u.nombre} (${u.tipo === "BODEGA" ? "Bodega" : "Botiquín"})`,
        }))}
      />
      <section className="pos-panel">
        <div className="pos-title">
          <h2>Remesas recibidas</h2>
          <span>{remesas.length}</span>
        </div>
        {remesas.length ? (
          <table className={styles.tabla}>
            <thead>
              <tr>
                <th>Recibida</th>
                <th>Proveedor · guía</th>
                <th>Lotes</th>
                <th className={styles.num}>Unidades</th>
              </tr>
            </thead>
            <tbody>
              {remesas.map((r) => (
                <tr key={r.id}>
                  <td>{fecha.format(r.recibidaEn)}</td>
                  <td>
                    <b>{r.proveedor}</b>
                    <br />
                    <small>{r.guia}</small>
                  </td>
                  <td>
                    {r.detalles.map((d) => (
                      <small key={d.id} style={{ display: "block" }}>
                        {d.lote.medicamento.nombre} · lote {d.lote.numeroLote} ·
                        vence{" "}
                        {d.lote.fechaVencimiento.toISOString().slice(0, 10)} ·{" "}
                        {d.cantidad} u.
                      </small>
                    ))}
                  </td>
                  <td className={styles.num}>
                    {r.detalles.reduce((n, d) => n + d.cantidad, 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="pos-empty">Aún no se han recibido remesas.</p>
        )}
      </section>
    </section>
  );
}

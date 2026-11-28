import { connection } from "next/server";
import {
  type PharmacyParams,
  resolvePharmacy,
} from "@/lib/auth/pharmacy-scope";
import { requirePharmacyUser } from "@/lib/auth/session";
import { prismaAsistencial as db } from "@/lib/db/prisma-asistencial";
import { etiquetaTipoPrograma } from "@/lib/validation/dispensacion";
import { SoloAsistencial } from "../_components/solo-asistencial";
import styles from "../dispensacion/_components/dispensacion.module.css";

export const instant = false;

export default async function ProgramasPage({ params }: PharmacyParams) {
  const pharmacy = await resolvePharmacy(params);
  await requirePharmacyUser(pharmacy);
  if (pharmacy !== "asistencial")
    return <SoloAsistencial titulo="Programas de Salud" />;
  await connection();
  const programas = await db.programaSalud.findMany({
    orderBy: [{ activo: "desc" }, { nombre: "asc" }],
    include: {
      medicamentos: {
        include: {
          medicamento: {
            select: {
              nombre: true,
              concentracion: true,
              formaFarmaceutica: true,
            },
          },
        },
      },
      _count: {
        select: {
          inscripciones: { where: { activo: true } },
          dispensaciones: true,
        },
      },
    },
  });
  return (
    <section className="pos-shell">
      <header className="pos-header">
        <div>
          <h1>Programas de Salud</h1>
          <span>
            Programas GES/AUGE y de crónicos con los medicamentos que cubren y
            la cuota mensual por paciente.
          </span>
        </div>
      </header>
      <div className="pos-metrics">
        <div>
          <small>Programas activos</small>
          <strong>{programas.filter((p) => p.activo).length}</strong>
        </div>
        <div>
          <small>Inscripciones vigentes</small>
          <strong>
            {programas.reduce((n, p) => n + p._count.inscripciones, 0)}
          </strong>
        </div>
        <div>
          <small>Entregas registradas</small>
          <strong>
            {programas.reduce((n, p) => n + p._count.dispensaciones, 0)}
          </strong>
        </div>
        <div>
          <small>Medicamentos cubiertos</small>
          <strong>
            {
              new Set(
                programas.flatMap((p) =>
                  p.medicamentos.map((m) => m.medicamentoId),
                ),
              ).size
            }
          </strong>
        </div>
      </div>
      {programas.length ? (
        programas.map((p) => (
          <section className="pos-panel" key={p.id}>
            <div className="pos-title">
              <div>
                <small>
                  {p.codigo} · {etiquetaTipoPrograma[p.tipo]}
                  {!p.activo && " · INACTIVO"}
                </small>
                <h2>{p.nombre}</h2>
              </div>
              <span>{p._count.inscripciones} inscritos</span>
            </div>
            <table className={styles.tabla}>
              <thead>
                <tr>
                  <th>Medicamento</th>
                  <th className={styles.num}>Cuota mensual por paciente</th>
                </tr>
              </thead>
              <tbody>
                {p.medicamentos.map((m) => (
                  <tr key={m.medicamentoId}>
                    <td>
                      {[
                        m.medicamento.nombre,
                        m.medicamento.concentracion,
                        m.medicamento.formaFarmaceutica,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </td>
                    <td className={styles.num}>{m.cuotaMensual}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))
      ) : (
        <p className="pos-empty">
          No hay programas. Carga los de demostración con{" "}
          <code>npm run demo:asistencial -- --apply</code>.
        </p>
      )}
      <p className="pos-footnote">
        Las cuotas son parámetros del simulador; ajústalas con la Dirección de
        Carrera.
      </p>
    </section>
  );
}

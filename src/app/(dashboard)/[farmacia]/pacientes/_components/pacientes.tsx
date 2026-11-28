"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { formatRut } from "@/lib/user-input";
import { pacienteSchema } from "@/lib/validation/dispensacion";
import styles from "../../dispensacion/_components/dispensacion.module.css";

type Paciente = {
  id: number;
  rut: string;
  nombre: string;
  entregas: number;
  inscripciones: { programaId: number; programa: string; activo: boolean }[];
};

async function enviar(url: string, body: unknown) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error ?? "No se pudo guardar.");
  return data;
}

export function Pacientes({
  pacientes,
  programas,
  busqueda,
}: {
  pacientes: Paciente[];
  programas: { id: number; nombre: string }[];
  busqueda: string;
}) {
  const router = useRouter();
  const id = useId();
  const [nuevo, setNuevo] = useState(false);
  const [form, setForm] = useState({
    rut: "",
    nombre: "",
    fechaNacimiento: "",
    telefono: "",
    direccion: "",
  });
  const [inscribir, setInscribir] = useState<Paciente | null>(null);
  const [programaId, setProgramaId] = useState(0);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function accion(fn: () => Promise<string>) {
    setOcupado(true);
    setError("");
    try {
      setAviso(await fn());
      router.refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de conexión.");
      return false;
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="pos-shell">
      <header className="pos-header">
        <div>
          <h1>Pacientes</h1>
          <span>
            Pacientes de la red pública y sus programas de salud. Solo los
            inscritos pueden retirar medicamentos sin costo.
          </span>
        </div>
      </header>
      {aviso && (
        <p className={styles.exito} role="status">
          {aviso}
        </p>
      )}
      <section className="pos-panel">
        <div className="pos-title">
          <form className={styles.buscar} action="/asistencial/pacientes">
            <label>
              Buscar por RUT o nombre
              <input name="q" defaultValue={busqueda} maxLength={60} />
            </label>
            <button type="submit">Buscar</button>
          </form>
          <button
            type="button"
            className="pos-charge"
            onClick={() => {
              setError("");
              setNuevo(true);
            }}
          >
            <Plus aria-hidden size={16} /> Nuevo paciente
          </button>
        </div>
        {pacientes.length ? (
          <table className={styles.tabla}>
            <thead>
              <tr>
                <th>Paciente</th>
                <th>Programas</th>
                <th className={styles.num}>Entregas</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pacientes.map((p) => (
                <tr key={p.id}>
                  <td>
                    <b>{p.nombre}</b>
                    <br />
                    <small>{p.rut}</small>
                  </td>
                  <td>
                    {p.inscripciones.length
                      ? p.inscripciones.map((i) => (
                          <span
                            key={i.programaId}
                            className={styles.chip}
                            data-inactivo={!i.activo || undefined}
                          >
                            {i.programa}
                            <button
                              type="button"
                              title={i.activo ? "Desactivar" : "Activar"}
                              aria-label={`${i.activo ? "Desactivar" : "Activar"} ${i.programa}`}
                              disabled={ocupado}
                              onClick={() =>
                                accion(async () => {
                                  await enviar(
                                    "/api/asistencial/pacientes/inscripciones",
                                    {
                                      pacienteId: p.id,
                                      programaId: i.programaId,
                                      activo: !i.activo,
                                    },
                                  );
                                  return `${p.nombre}: ${i.programa} ${i.activo ? "desactivado" : "activado"}.`;
                                })
                              }
                            >
                              {i.activo ? "×" : "↺"}
                            </button>
                          </span>
                        ))
                      : "Sin programas"}
                  </td>
                  <td className={styles.num}>{p.entregas}</td>
                  <td>
                    <span className={styles.cantidad}>
                      <button
                        type="button"
                        onClick={() => {
                          setError("");
                          setProgramaId(0);
                          setInscribir(p);
                        }}
                      >
                        Inscribir
                      </button>
                      <Link
                        href={`/asistencial/dispensacion?rut=${encodeURIComponent(p.rut)}`}
                      >
                        Dispensar
                      </Link>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="pos-empty">
            {busqueda
              ? "No hay pacientes que coincidan."
              : "Todavía no hay pacientes registrados."}
          </p>
        )}
      </section>

      <Modal
        open={nuevo}
        onOpenChange={(o) => !ocupado && setNuevo(o)}
        title="Nuevo paciente"
        description="Después podrás inscribirlo en sus programas de salud."
      >
        <form
          className={styles.grupo}
          onSubmit={async (e) => {
            e.preventDefault();
            const parsed = pacienteSchema.safeParse(form);
            if (!parsed.success)
              return setError(
                parsed.error.issues[0]?.message ?? "Revisa los datos.",
              );
            if (
              await accion(async () => {
                await enviar("/api/asistencial/pacientes", parsed.data);
                return `${parsed.data.nombre} registrado.`;
              })
            ) {
              setNuevo(false);
              setForm({
                rut: "",
                nombre: "",
                fechaNacimiento: "",
                telefono: "",
                direccion: "",
              });
            }
          }}
        >
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          <label htmlFor={`${id}-rut`}>
            RUT
            <input
              id={`${id}-rut`}
              value={form.rut}
              placeholder="12.345.678-9"
              onChange={(e) =>
                setForm({ ...form, rut: formatRut(e.target.value) })
              }
            />
          </label>
          <label htmlFor={`${id}-nombre`}>
            Nombre completo
            <input
              id={`${id}-nombre`}
              value={form.nombre}
              maxLength={120}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            />
          </label>
          <label htmlFor={`${id}-nac`}>
            Fecha de nacimiento (opcional)
            <input
              id={`${id}-nac`}
              type="date"
              value={form.fechaNacimiento}
              onChange={(e) =>
                setForm({ ...form, fechaNacimiento: e.target.value })
              }
            />
          </label>
          <label htmlFor={`${id}-tel`}>
            Teléfono (opcional)
            <input
              id={`${id}-tel`}
              value={form.telefono}
              maxLength={20}
              onChange={(e) => setForm({ ...form, telefono: e.target.value })}
            />
          </label>
          <label htmlFor={`${id}-dir`}>
            Dirección (opcional)
            <input
              id={`${id}-dir`}
              value={form.direccion}
              maxLength={160}
              onChange={(e) => setForm({ ...form, direccion: e.target.value })}
            />
          </label>
          <button type="submit" className="pos-charge" disabled={ocupado}>
            Guardar paciente
          </button>
        </form>
      </Modal>

      <Modal
        open={inscribir !== null}
        onOpenChange={(o) => !ocupado && !o && setInscribir(null)}
        title={`Inscribir a ${inscribir?.nombre ?? ""}`}
        description="La inscripción queda vigente desde hoy."
      >
        <form
          className={styles.grupo}
          onSubmit={async (e) => {
            e.preventDefault();
            if (!inscribir || !programaId)
              return setError("Selecciona el programa.");
            const p = programas.find((x) => x.id === programaId);
            if (
              await accion(async () => {
                await enviar("/api/asistencial/pacientes/inscripciones", {
                  pacienteId: inscribir.id,
                  programaId,
                  activo: true,
                });
                return `${inscribir.nombre} inscrito en ${p?.nombre}.`;
              })
            )
              setInscribir(null);
          }}
        >
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          <label htmlFor={`${id}-prog`}>
            Programa
            <select
              id={`${id}-prog`}
              value={programaId}
              onChange={(e) => setProgramaId(Number(e.target.value))}
            >
              <option value={0}>Selecciona…</option>
              {programas
                .filter(
                  (pr) =>
                    !inscribir?.inscripciones.some(
                      (i) => i.programaId === pr.id && i.activo,
                    ),
                )
                .map((pr) => (
                  <option key={pr.id} value={pr.id}>
                    {pr.nombre}
                  </option>
                ))}
            </select>
          </label>
          <button type="submit" className="pos-charge" disabled={ocupado}>
            Inscribir
          </button>
        </form>
      </Modal>
    </section>
  );
}

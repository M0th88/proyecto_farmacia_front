"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { remesaSchema } from "@/lib/validation/dispensacion";
import styles from "../../dispensacion/_components/dispensacion.module.css";

type Opcion = { id: number; nombre: string };
type Fila = {
  medicamentoId: number;
  numeroLote: string;
  fechaVencimiento: string;
  cantidad: string;
  ubicacionId: number;
};

export function NuevaRemesa({
  medicamentos,
  ubicaciones,
}: {
  medicamentos: Opcion[];
  ubicaciones: Opcion[];
}) {
  const router = useRouter();
  const filaVacia = (): Fila => ({
    medicamentoId: 0,
    numeroLote: "",
    fechaVencimiento: "",
    cantidad: "",
    ubicacionId: ubicaciones[0]?.id ?? 0,
  });
  const [guia, setGuia] = useState("");
  const [filas, setFilas] = useState<Fila[]>([filaVacia()]);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const set = (i: number, cambios: Partial<Fila>) =>
    setFilas(filas.map((f, j) => (j === i ? { ...f, ...cambios } : f)));

  async function guardar() {
    setError("");
    setAviso("");
    const parsed = remesaSchema.safeParse({
      guia,
      items: filas.map((f) => ({ ...f, cantidad: Number(f.cantidad) })),
    });
    if (!parsed.success)
      return setError(parsed.error.issues[0]?.message ?? "Revisa los datos.");
    setOcupado(true);
    try {
      const r = await fetch("/api/asistencial/remesas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error ?? "No se pudo registrar.");
      setAviso(
        `Remesa guía ${parsed.data.guia} recibida: ${parsed.data.items.length} lotes.`,
      );
      setGuia("");
      setFilas([filaVacia()]);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de conexión.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="pos-panel">
      <div className="pos-title">
        <h2>Recibir remesa</h2>
      </div>
      <fieldset className={styles.grupo} disabled={ocupado}>
        <legend>Guía de despacho CENABAST</legend>
        <label>
          N° de guía
          <input
            value={guia}
            maxLength={40}
            placeholder="GD-CENABAST-2026-0002"
            onChange={(e) => setGuia(e.target.value)}
          />
        </label>
      </fieldset>
      <table className={styles.tabla}>
        <thead>
          <tr>
            <th>Medicamento</th>
            <th>Lote</th>
            <th>Vencimiento</th>
            <th className={styles.num}>Cantidad</th>
            <th>Ubicación</th>
            <th aria-label="Quitar" />
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: filas editables sin id propio
            <tr key={i}>
              <td>
                <select
                  className={styles.celda}
                  aria-label="Medicamento"
                  value={f.medicamentoId}
                  onChange={(e) =>
                    set(i, { medicamentoId: Number(e.target.value) })
                  }
                >
                  <option value={0}>Selecciona…</option>
                  {medicamentos.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <input
                  className={styles.celda}
                  aria-label="Número de lote"
                  value={f.numeroLote}
                  maxLength={60}
                  onChange={(e) => set(i, { numeroLote: e.target.value })}
                />
              </td>
              <td>
                <input
                  className={styles.celda}
                  type="date"
                  aria-label="Vencimiento"
                  value={f.fechaVencimiento}
                  onChange={(e) => set(i, { fechaVencimiento: e.target.value })}
                />
              </td>
              <td className={styles.num}>
                <input
                  className={styles.celda}
                  type="number"
                  min={1}
                  step={1}
                  aria-label="Cantidad"
                  value={f.cantidad}
                  onChange={(e) => set(i, { cantidad: e.target.value })}
                />
              </td>
              <td>
                <select
                  className={styles.celda}
                  aria-label="Ubicación"
                  value={f.ubicacionId}
                  onChange={(e) =>
                    set(i, { ubicacionId: Number(e.target.value) })
                  }
                >
                  {ubicaciones.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <button
                  type="button"
                  className={styles.icono}
                  aria-label="Quitar lote"
                  disabled={filas.length === 1}
                  onClick={() => setFilas(filas.filter((_, j) => j !== i))}
                >
                  <Trash2 aria-hidden size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className={styles.acciones}>
        <button
          type="button"
          className={styles.secundario}
          onClick={() => setFilas([...filas, filaVacia()])}
        >
          <Plus aria-hidden size={16} /> Agregar lote
        </button>
        <button
          type="button"
          className="pos-charge"
          disabled={ocupado}
          onClick={guardar}
        >
          Registrar recepción
        </button>
      </div>
      {aviso && (
        <p className={styles.exito} role="status">
          {aviso}
        </p>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

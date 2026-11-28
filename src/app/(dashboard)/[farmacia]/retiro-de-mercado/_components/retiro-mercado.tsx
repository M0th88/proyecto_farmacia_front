"use client";

import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import g from "@/components/gestion.module.css";
import { Modal } from "@/components/ui/modal";
import { enviar } from "@/lib/client-api";
import { alertaRetiroSchema } from "@/lib/validation/abastecimiento";
import { hoyChile } from "@/lib/validation/recetas";

type Alerta = {
  id: number;
  resolucion: string;
  fecha: string;
  producto: string;
  lotes: string[];
  motivo: string;
  estado: string;
  unidades: number;
  existencias: { lote: string; ubicacion: string; cantidad: number }[];
};
type Producto = {
  id: number;
  nombre: string;
  lotes: { numero: string; retirado: boolean }[];
};

export function RetiroMercado({
  alertas,
  productos,
}: {
  alertas: Alerta[];
  productos: Producto[];
}) {
  const router = useRouter();
  const id = useId();
  const [form, setForm] = useState<{
    resolucion: string;
    fecha: string;
    medicamentoId: number;
    lotes: string[];
    motivo: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const activas = alertas.filter((a) => a.estado === "ACTIVA");
  const producto = productos.find((p) => p.id === form?.medicamentoId);

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
          <h1>Retiro de Mercado</h1>
          <span>
            Alertas sanitarias del ISP. Al registrarlas, los lotes afectados
            quedan bloqueados en el POS y listos para devolver al proveedor.
          </span>
        </div>
      </header>
      <div className="pos-metrics">
        <div>
          <small>Alertas activas</small>
          <strong>{activas.length}</strong>
        </div>
        <div>
          <small>Unidades retenidas</small>
          <strong>{activas.reduce((t, a) => t + a.unidades, 0)}</strong>
        </div>
        <div>
          <small>Lotes bloqueados</small>
          <strong>
            {productos.reduce(
              (t, p) => t + p.lotes.filter((l) => l.retirado).length,
              0,
            )}
          </strong>
        </div>
        <div>
          <small>Alertas cerradas</small>
          <strong>{alertas.length - activas.length}</strong>
        </div>
      </div>
      {aviso && (
        <p className={g.ok} role="status">
          {aviso}
        </p>
      )}
      {error && !form && (
        <p className={g.error} role="alert">
          {error}
        </p>
      )}
      <section className="pos-panel">
        <div className={g.barra}>
          <span className={g.nota}>
            Las unidades retenidas se devuelven desde{" "}
            <Link href="/privada/devoluciones-a-proveedor">
              Devoluciones a Proveedor
            </Link>
            .
          </span>
          <button
            type="button"
            className={g.peligro}
            disabled={!productos.length}
            onClick={() => {
              setError("");
              setForm({
                resolucion: "",
                fecha: hoyChile(),
                medicamentoId: productos[0]?.id ?? 0,
                lotes: [],
                motivo: "",
              });
            }}
          >
            <ShieldAlert aria-hidden size={16} /> Registrar alerta ISP
          </button>
        </div>
        {alertas.length ? (
          <div className={g.scroll}>
            <table className={g.tabla}>
              <thead>
                <tr>
                  <th>Alerta</th>
                  <th>Producto · lotes</th>
                  <th>Existencias retenidas</th>
                  <th>Estado</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {alertas.map((a) => (
                  <tr
                    key={a.id}
                    data-inactivo={a.estado === "CERRADA" || undefined}
                  >
                    <td>
                      <b>{a.resolucion}</b>
                      <small>
                        {a.fecha} · {a.motivo}
                      </small>
                    </td>
                    <td>
                      {a.producto}
                      <small>Lotes: {a.lotes.join(", ")}</small>
                    </td>
                    <td>
                      {a.existencias.length
                        ? a.existencias.map((x) => (
                            <small key={`${x.lote}-${x.ubicacion}`}>
                              {x.cantidad} u. · lote {x.lote} · {x.ubicacion}
                            </small>
                          ))
                        : "Sin unidades en stock"}
                    </td>
                    <td>
                      <span
                        className={g.estado}
                        data-tono={
                          a.estado === "ACTIVA" ? "peligro" : undefined
                        }
                      >
                        {a.estado === "ACTIVA" ? "Activa" : "Cerrada"}
                      </span>
                    </td>
                    <td>
                      {a.estado === "ACTIVA" && (
                        <button
                          type="button"
                          className={g.boton}
                          disabled={ocupado}
                          title={
                            a.unidades
                              ? "Aún hay unidades retenidas; devuélvelas antes de cerrar"
                              : undefined
                          }
                          onClick={() => {
                            if (
                              a.unidades &&
                              !window.confirm(
                                `Quedan ${a.unidades} unidades retenidas. ¿Cerrar la alerta igual? Los lotes seguirán bloqueados.`,
                              )
                            )
                              return;
                            void accion(async () => {
                              await enviar("/api/privada/retiros", "PATCH", {
                                id: a.id,
                              });
                              return `Alerta ${a.resolucion} cerrada.`;
                            });
                          }}
                        >
                          Cerrar alerta
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="pos-empty">
            No hay alertas registradas. Cuando el ISP emita un retiro,
            regístralo aquí para bloquear los lotes.
          </p>
        )}
      </section>

      <Modal
        open={form !== null}
        onOpenChange={(o) => !ocupado && !o && setForm(null)}
        title="Registrar alerta de retiro"
        description="Los lotes marcados dejan de venderse de inmediato."
      >
        {form && (
          <form
            className={g.form}
            onSubmit={async (e) => {
              e.preventDefault();
              const parsed = alertaRetiroSchema.safeParse(form);
              if (!parsed.success)
                return setError(
                  parsed.error.issues[0]?.message ?? "Revisa los datos.",
                );
              if (
                await accion(async () => {
                  const r = await enviar<{ bloqueados: number }>(
                    "/api/privada/retiros",
                    "POST",
                    parsed.data,
                  );
                  return `Alerta ${parsed.data.resolucion} registrada: ${r.bloqueados} lotes bloqueados.`;
                })
              )
                setForm(null);
            }}
          >
            {error && (
              <p className={g.error} role="alert">
                {error}
              </p>
            )}
            <div className={g.campos}>
              <label htmlFor={`${id}-r`}>
                N° resolución / alerta ISP
                <input
                  id={`${id}-r`}
                  maxLength={60}
                  value={form.resolucion}
                  placeholder="Ej. Alerta 012/2026"
                  onChange={(e) =>
                    setForm({ ...form, resolucion: e.target.value })
                  }
                />
              </label>
              <label htmlFor={`${id}-f`}>
                Fecha
                <input
                  id={`${id}-f`}
                  type="date"
                  value={form.fecha}
                  onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                />
              </label>
            </div>
            <label htmlFor={`${id}-p`}>
              Producto
              <select
                id={`${id}-p`}
                value={form.medicamentoId}
                onChange={(e) =>
                  setForm({
                    ...form,
                    medicamentoId: Number(e.target.value),
                    lotes: [],
                  })
                }
              >
                {productos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className={g.form}>
              <legend className={g.nota}>Lotes afectados</legend>
              {producto?.lotes.map((l) => (
                <label key={l.numero} className={g.check}>
                  <input
                    type="checkbox"
                    disabled={l.retirado}
                    checked={l.retirado || form.lotes.includes(l.numero)}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        lotes: e.target.checked
                          ? [...form.lotes, l.numero]
                          : form.lotes.filter((x) => x !== l.numero),
                      })
                    }
                  />
                  {l.numero}
                  {l.retirado && " (ya retirado)"}
                </label>
              ))}
            </fieldset>
            <label htmlFor={`${id}-m`}>
              Motivo
              <textarea
                id={`${id}-m`}
                rows={2}
                maxLength={300}
                value={form.motivo}
                placeholder="Ej. Desviación de calidad informada por el fabricante"
                onChange={(e) => setForm({ ...form, motivo: e.target.value })}
              />
            </label>
            <button type="submit" className={g.peligro} disabled={ocupado}>
              <ShieldAlert aria-hidden size={16} /> Registrar y bloquear lotes
            </button>
          </form>
        )}
      </Modal>
    </section>
  );
}

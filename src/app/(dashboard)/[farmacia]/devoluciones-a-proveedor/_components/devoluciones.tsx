"use client";

import { FileCheck2, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import g from "@/components/gestion.module.css";
import { Modal } from "@/components/ui/modal";
import { clp, enviar } from "@/lib/client-api";
import {
  cierreDevolucionSchema,
  devolucionSchema,
  MOTIVOS_DEVOLUCION,
  type MotivoDevolucion,
} from "@/lib/validation/abastecimiento";

type Devolucion = {
  id: number;
  fecha: string;
  proveedor: string;
  motivo: string;
  guia: string;
  estado: string;
  notaCredito: string;
  monto: number | null;
  items: { id: number; producto: string; cantidad: number }[];
};
type Existencia = {
  stockId: number;
  producto: string;
  lote: string;
  vencimiento: string;
  ubicacion: string;
  cantidad: number;
  razon: "VENCIDO" | "RETIRO_MERCADO";
};

export function Devoluciones({
  devoluciones,
  proveedores,
  existencias,
}: {
  devoluciones: Devolucion[];
  proveedores: { id: number; nombre: string }[];
  existencias: Existencia[];
}) {
  const router = useRouter();
  const id = useId();
  const [nueva, setNueva] = useState<{
    proveedorId: number;
    motivo: MotivoDevolucion;
    guia: string;
    observaciones: string;
    cantidades: Record<number, string>;
  } | null>(null);
  const [cerrar, setCerrar] = useState<Devolucion | null>(null);
  const [nota, setNota] = useState({ notaCredito: "", monto: "" });
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const abiertas = devoluciones.filter((d) => d.estado === "EMITIDA");

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
          <h1>Devoluciones a Proveedor</h1>
          <span>
            Salida de productos vencidos, retirados del mercado o rechazados.
            Descuenta el stock y controla la nota de crédito del proveedor.
          </span>
        </div>
      </header>
      <div className="pos-metrics">
        <div>
          <small>Esperando nota de crédito</small>
          <strong>{abiertas.length}</strong>
        </div>
        <div>
          <small>Unidades por devolver en stock</small>
          <strong>{existencias.reduce((t, e) => t + e.cantidad, 0)}</strong>
        </div>
        <div>
          <small>Notas de crédito recibidas</small>
          <strong>
            {clp(devoluciones.reduce((t, d) => t + (d.monto ?? 0), 0))}
          </strong>
        </div>
        <div>
          <small>Devoluciones</small>
          <strong>{devoluciones.length}</strong>
        </div>
      </div>
      {aviso && (
        <p className={g.ok} role="status">
          {aviso}
        </p>
      )}
      {error && !nueva && !cerrar && (
        <p className={g.error} role="alert">
          {error}
        </p>
      )}
      <section className="pos-panel">
        <div className={g.barra}>
          <span className={g.nota}>
            Los rechazos en recepción se devuelven desde{" "}
            <Link href="/privada/productos-rechazados">
              Productos Rechazados
            </Link>
            .
          </span>
          <button
            type="button"
            className={g.primario}
            disabled={!proveedores.length || !existencias.length}
            title={
              !existencias.length
                ? "No hay unidades vencidas ni retiradas en stock"
                : undefined
            }
            onClick={() => {
              setError("");
              setNueva({
                proveedorId: proveedores[0]?.id ?? 0,
                motivo: existencias[0]?.razon ?? "VENCIDO",
                guia: "",
                observaciones: "",
                cantidades: {},
              });
            }}
          >
            <Plus aria-hidden size={16} /> Devolver desde stock
          </button>
        </div>
        {devoluciones.length ? (
          <div className={g.scroll}>
            <table className={g.tabla}>
              <thead>
                <tr>
                  <th>Devolución</th>
                  <th>Proveedor</th>
                  <th>Productos</th>
                  <th>Motivo</th>
                  <th>Nota de crédito</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {devoluciones.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <b>#{d.id}</b>
                      <small>
                        {d.fecha}
                        {d.guia && ` · guía ${d.guia}`}
                      </small>
                    </td>
                    <td>{d.proveedor}</td>
                    <td>
                      {d.items.map((i) => (
                        <small key={i.id}>
                          {i.cantidad} × {i.producto}
                        </small>
                      ))}
                    </td>
                    <td>
                      {MOTIVOS_DEVOLUCION[d.motivo as MotivoDevolucion] ??
                        d.motivo}
                    </td>
                    <td>
                      {d.estado === "CERRADA" ? (
                        <span className={g.estado} data-tono="ok">
                          N° {d.notaCredito} · {clp(d.monto ?? 0)}
                        </span>
                      ) : (
                        <span className={g.estado} data-tono="alerta">
                          Pendiente
                        </span>
                      )}
                    </td>
                    <td>
                      {d.estado === "EMITIDA" && (
                        <button
                          type="button"
                          className={g.boton}
                          onClick={() => {
                            setError("");
                            setNota({ notaCredito: "", monto: "" });
                            setCerrar(d);
                          }}
                        >
                          <FileCheck2 aria-hidden size={14} /> Registrar nota
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="pos-empty">Aún no hay devoluciones.</p>
        )}
      </section>

      <Modal
        open={nueva !== null}
        onOpenChange={(o) => !ocupado && !o && setNueva(null)}
        title="Devolver desde stock"
        description="Elige cuántas unidades vencidas o retiradas salen hacia el proveedor."
      >
        {nueva && (
          <form
            className={g.form}
            onSubmit={async (e) => {
              e.preventDefault();
              const items = Object.entries(nueva.cantidades)
                .map(([stockId, c]) => ({
                  stockId: Number(stockId),
                  cantidad: Number(c),
                }))
                .filter((i) => i.cantidad > 0);
              const parsed = devolucionSchema.safeParse({ ...nueva, items });
              if (!parsed.success)
                return setError(
                  parsed.error.issues[0]?.message ?? "Revisa los datos.",
                );
              if (
                await accion(async () => {
                  const r = await enviar<{ id: number }>(
                    "/api/privada/devoluciones",
                    "POST",
                    parsed.data,
                  );
                  return `Devolución #${r.id} emitida: ${items.reduce((t, i) => t + i.cantidad, 0)} unidades salieron del stock.`;
                })
              )
                setNueva(null);
            }}
          >
            {error && (
              <p className={g.error} role="alert">
                {error}
              </p>
            )}
            <div className={g.campos}>
              <label htmlFor={`${id}-p`}>
                Proveedor
                <select
                  id={`${id}-p`}
                  value={nueva.proveedorId}
                  onChange={(e) =>
                    setNueva({ ...nueva, proveedorId: Number(e.target.value) })
                  }
                >
                  {proveedores.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label htmlFor={`${id}-m`}>
                Motivo
                <select
                  id={`${id}-m`}
                  value={nueva.motivo}
                  onChange={(e) =>
                    setNueva({
                      ...nueva,
                      motivo: e.target.value as MotivoDevolucion,
                    })
                  }
                >
                  {(["VENCIDO", "RETIRO_MERCADO", "OTRO"] as const).map((m) => (
                    <option key={m} value={m}>
                      {MOTIVOS_DEVOLUCION[m]}
                    </option>
                  ))}
                </select>
              </label>
              <label htmlFor={`${id}-g`}>
                N° guía (opcional)
                <input
                  id={`${id}-g`}
                  maxLength={40}
                  value={nueva.guia}
                  onChange={(e) => setNueva({ ...nueva, guia: e.target.value })}
                />
              </label>
            </div>
            <div className={g.scroll}>
              <table className={g.tabla}>
                <thead>
                  <tr>
                    <th>Producto · lote</th>
                    <th>Razón</th>
                    <th className={g.num}>Disponible</th>
                    <th className={g.num}>Devolver</th>
                  </tr>
                </thead>
                <tbody>
                  {existencias.map((x) => (
                    <tr key={x.stockId}>
                      <td>
                        {x.producto}
                        <small>
                          Lote {x.lote} · vence {x.vencimiento} · {x.ubicacion}
                        </small>
                      </td>
                      <td>
                        <span
                          className={g.estado}
                          data-tono={
                            x.razon === "VENCIDO" ? "peligro" : "alerta"
                          }
                        >
                          {x.razon === "VENCIDO" ? "Vencido" : "Retiro ISP"}
                        </span>
                      </td>
                      <td className={g.num}>{x.cantidad}</td>
                      <td className={g.num}>
                        <input
                          className={g.celda}
                          type="number"
                          min={0}
                          max={x.cantidad}
                          aria-label={`Unidades a devolver de ${x.producto}`}
                          value={nueva.cantidades[x.stockId] ?? ""}
                          placeholder="0"
                          onChange={(e) =>
                            setNueva({
                              ...nueva,
                              cantidades: {
                                ...nueva.cantidades,
                                [x.stockId]: e.target.value,
                              },
                            })
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="submit" className={g.primario} disabled={ocupado}>
              Emitir devolución
            </button>
          </form>
        )}
      </Modal>

      <Modal
        open={cerrar !== null}
        onOpenChange={(o) => !ocupado && !o && setCerrar(null)}
        title={`Nota de crédito · devolución #${cerrar?.id ?? ""}`}
        description="Registra el documento con que el proveedor compensó la devolución."
      >
        {cerrar && (
          <form
            className={g.form}
            onSubmit={async (e) => {
              e.preventDefault();
              const parsed = cierreDevolucionSchema.safeParse({
                notaCredito: nota.notaCredito,
                montoNotaCredito: Number(nota.monto),
              });
              if (!parsed.success)
                return setError(
                  parsed.error.issues[0]?.message ?? "Revisa los datos.",
                );
              if (
                await accion(async () => {
                  await enviar("/api/privada/devoluciones", "PATCH", {
                    id: cerrar.id,
                    ...parsed.data,
                  });
                  return `Devolución #${cerrar.id} cerrada con nota de crédito ${parsed.data.notaCredito}.`;
                })
              )
                setCerrar(null);
            }}
          >
            {error && (
              <p className={g.error} role="alert">
                {error}
              </p>
            )}
            <div className={g.campos}>
              <label htmlFor={`${id}-nc`}>
                N° nota de crédito
                <input
                  id={`${id}-nc`}
                  maxLength={40}
                  value={nota.notaCredito}
                  onChange={(e) =>
                    setNota({ ...nota, notaCredito: e.target.value })
                  }
                />
              </label>
              <label htmlFor={`${id}-mo`}>
                Monto (CLP)
                <input
                  id={`${id}-mo`}
                  type="number"
                  min={0}
                  value={nota.monto}
                  onChange={(e) => setNota({ ...nota, monto: e.target.value })}
                />
              </label>
            </div>
            <button type="submit" className={g.primario} disabled={ocupado}>
              Cerrar devolución
            </button>
          </form>
        )}
      </Modal>
    </section>
  );
}

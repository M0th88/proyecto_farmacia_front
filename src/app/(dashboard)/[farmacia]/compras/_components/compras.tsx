"use client";

import { PackageCheck, Plus, Send, Trash2, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import g from "@/components/gestion.module.css";
import { Modal } from "@/components/ui/modal";
import { clp, enviar } from "@/lib/client-api";
import {
  ESTADOS_ORDEN,
  type EstadoOrden,
  MOTIVOS_RECHAZO,
  type MotivoRechazo,
  ordenCompraSchema,
  recepcionSchema,
} from "@/lib/validation/abastecimiento";

type Item = {
  id: number;
  producto: string;
  cantidad: number;
  costoUnitario: number;
  recibida: number;
  rechazada: number;
};
type Orden = {
  id: number;
  estado: string;
  proveedor: string;
  creadaEn: string;
  fechaEsperada: string;
  observaciones: string;
  items: Item[];
};
type Opcion = { id: number; nombre: string };
type LineaNueva = { medicamentoId: number; cantidad: string; costo: string };
type LineaRecepcion = {
  aceptada: string;
  numeroLote: string;
  vencimiento: string;
  rechazada: string;
  motivoRechazo: MotivoRechazo | "";
};

const TONO: Record<string, string | undefined> = {
  BORRADOR: undefined,
  ENVIADA: "info",
  RECIBIDA_PARCIAL: "alerta",
  RECIBIDA: "ok",
  ANULADA: "peligro",
};
const totalOrden = (o: Orden) =>
  o.items.reduce((t, i) => t + i.cantidad * i.costoUnitario, 0);
const pendiente = (i: Item) => i.cantidad - i.recibida - i.rechazada;

export function Compras({
  ordenes,
  proveedores,
  productos,
  ubicaciones,
}: {
  ordenes: Orden[];
  proveedores: Opcion[];
  productos: Opcion[];
  ubicaciones: Opcion[];
}) {
  const router = useRouter();
  const id = useId();
  const [filtro, setFiltro] = useState<"abiertas" | "todas">("abiertas");
  const [nueva, setNueva] = useState<{
    proveedorId: number;
    fechaEsperada: string;
    observaciones: string;
    lineas: LineaNueva[];
  } | null>(null);
  const [recibir, setRecibir] = useState<Orden | null>(null);
  const [ubicacionId, setUbicacionId] = useState(ubicaciones[0]?.id ?? 0);
  const [recepcion, setRecepcion] = useState<Record<number, LineaRecepcion>>(
    {},
  );
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const abiertas = ordenes.filter((o) =>
    ["BORRADOR", "ENVIADA", "RECIBIDA_PARCIAL"].includes(o.estado),
  );
  const lista = filtro === "abiertas" ? abiertas : ordenes;

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

  async function crearOrden(enviarYa: boolean) {
    if (!nueva) return;
    const parsed = ordenCompraSchema.safeParse({
      ...nueva,
      items: nueva.lineas.map((l) => ({
        medicamentoId: l.medicamentoId,
        cantidad: Number(l.cantidad),
        costoUnitario: Number(l.costo),
      })),
    });
    if (!parsed.success)
      return setError(parsed.error.issues[0]?.message ?? "Revisa la orden.");
    if (
      await accion(async () => {
        const r = await enviar<{ id: number }>("/api/privada/compras", "POST", {
          ...parsed.data,
          enviar: enviarYa,
        });
        return `Orden #${r.id} ${enviarYa ? "creada y enviada" : "guardada como borrador"}.`;
      })
    )
      setNueva(null);
  }

  function abrirRecepcion(o: Orden) {
    setError("");
    setRecibir(o);
    setRecepcion(
      Object.fromEntries(
        o.items.map((i) => [
          i.id,
          {
            aceptada: String(pendiente(i)),
            numeroLote: "",
            vencimiento: "",
            rechazada: "0",
            motivoRechazo: "",
          },
        ]),
      ),
    );
  }

  async function confirmarRecepcion() {
    if (!recibir) return;
    const parsed = recepcionSchema.safeParse({
      ubicacionId,
      lineas: recibir.items
        .filter((i) => pendiente(i) > 0)
        .map((i) => {
          const l = recepcion[i.id];
          return {
            itemId: i.id,
            aceptada: Number(l.aceptada || 0),
            numeroLote: l.numeroLote,
            vencimiento: l.vencimiento,
            rechazada: Number(l.rechazada || 0),
            motivoRechazo: l.motivoRechazo || undefined,
          };
        }),
    });
    if (!parsed.success)
      return setError(
        parsed.error.issues[0]?.message ?? "Revisa la recepción.",
      );
    if (
      await accion(async () => {
        const r = await enviar<{
          completa: boolean;
          pendientesRevision: number;
        }>(`/api/privada/compras/${recibir.id}/recibir`, "POST", parsed.data);
        return `Orden #${recibir.id} ${r.completa ? "recibida completa" : "recibida en parte"}.${r.pendientesRevision ? ` ${r.pendientesRevision} líneas quedaron pendientes de revisión en Stocks y Lotes.` : ""}`;
      })
    )
      setRecibir(null);
  }

  return (
    <section className="pos-shell">
      <header className="pos-header">
        <div>
          <h1>Compras</h1>
          <span>
            Órdenes a proveedores y recepción de medicamentos por lote. Lo
            aceptado entra al stock FEFO; lo rechazado queda para devolución.
          </span>
        </div>
      </header>
      <div className="pos-metrics">
        <div>
          <small>Por enviar</small>
          <strong>
            {ordenes.filter((o) => o.estado === "BORRADOR").length}
          </strong>
        </div>
        <div>
          <small>En camino</small>
          <strong>
            {
              ordenes.filter(
                (o) =>
                  o.estado === "ENVIADA" || o.estado === "RECIBIDA_PARCIAL",
              ).length
            }
          </strong>
        </div>
        <div>
          <small>Recibidas</small>
          <strong>
            {ordenes.filter((o) => o.estado === "RECIBIDA").length}
          </strong>
        </div>
        <div>
          <small>Monto en curso</small>
          <strong>
            {clp(abiertas.reduce((t, o) => t + totalOrden(o), 0))}
          </strong>
        </div>
      </div>
      {aviso && (
        <p className={g.ok} role="status">
          {aviso}
        </p>
      )}
      {error && !nueva && !recibir && (
        <p className={g.error} role="alert">
          {error}
        </p>
      )}
      <section className="pos-panel">
        <div className={g.barra}>
          <div className={g.segmento} role="group" aria-label="Filtro">
            <button
              type="button"
              aria-pressed={filtro === "abiertas"}
              onClick={() => setFiltro("abiertas")}
            >
              Abiertas ({abiertas.length})
            </button>
            <button
              type="button"
              aria-pressed={filtro === "todas"}
              onClick={() => setFiltro("todas")}
            >
              Todas
            </button>
          </div>
          {proveedores.length ? (
            <button
              type="button"
              className={g.primario}
              onClick={() => {
                setError("");
                setNueva({
                  proveedorId: proveedores[0].id,
                  fechaEsperada: "",
                  observaciones: "",
                  lineas: [{ medicamentoId: 0, cantidad: "", costo: "" }],
                });
              }}
            >
              <Plus aria-hidden size={16} /> Nueva orden
            </button>
          ) : (
            <Link className={g.primario} href="/privada/proveedores">
              Crea un proveedor primero
            </Link>
          )}
        </div>
        {lista.length ? (
          <div className={g.scroll}>
            <table className={g.tabla}>
              <thead>
                <tr>
                  <th>Orden</th>
                  <th>Proveedor</th>
                  <th>Productos</th>
                  <th className={g.num}>Total</th>
                  <th>Estado</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {lista.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <b>#{o.id}</b>
                      <small>{o.creadaEn}</small>
                    </td>
                    <td>
                      {o.proveedor}
                      {o.fechaEsperada && (
                        <small>Llega: {o.fechaEsperada}</small>
                      )}
                    </td>
                    <td>
                      {o.items.map((i) => (
                        <small key={i.id}>
                          {i.cantidad} × {i.producto}
                          {i.recibida + i.rechazada > 0 &&
                            ` · ${i.recibida} recibidas${i.rechazada ? `, ${i.rechazada} rechazadas` : ""}`}
                        </small>
                      ))}
                    </td>
                    <td className={g.num}>{clp(totalOrden(o))}</td>
                    <td>
                      <span className={g.estado} data-tono={TONO[o.estado]}>
                        {ESTADOS_ORDEN[o.estado as EstadoOrden] ?? o.estado}
                      </span>
                    </td>
                    <td>
                      <div className={g.acciones}>
                        {o.estado === "BORRADOR" && (
                          <button
                            type="button"
                            className={g.boton}
                            disabled={ocupado}
                            onClick={() =>
                              accion(async () => {
                                await enviar("/api/privada/compras", "PATCH", {
                                  id: o.id,
                                  accion: "ENVIAR",
                                });
                                return `Orden #${o.id} enviada al proveedor.`;
                              })
                            }
                          >
                            <Send aria-hidden size={14} /> Enviar
                          </button>
                        )}
                        {(o.estado === "ENVIADA" ||
                          o.estado === "RECIBIDA_PARCIAL") && (
                          <button
                            type="button"
                            className={g.boton}
                            disabled={ocupado || !ubicaciones.length}
                            onClick={() => abrirRecepcion(o)}
                          >
                            <PackageCheck aria-hidden size={14} /> Recibir
                          </button>
                        )}
                        {(o.estado === "BORRADOR" ||
                          (o.estado === "ENVIADA" &&
                            o.items.every(
                              (i) => i.recibida + i.rechazada === 0,
                            ))) && (
                          <button
                            type="button"
                            className={g.peligro}
                            disabled={ocupado}
                            onClick={() => {
                              if (!window.confirm(`¿Anular la orden #${o.id}?`))
                                return;
                              void accion(async () => {
                                await enviar("/api/privada/compras", "PATCH", {
                                  id: o.id,
                                  accion: "ANULAR",
                                });
                                return `Orden #${o.id} anulada.`;
                              });
                            }}
                          >
                            <XCircle aria-hidden size={14} /> Anular
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="pos-empty">
            {filtro === "abiertas"
              ? "No hay órdenes abiertas."
              : "Aún no hay órdenes de compra."}
          </p>
        )}
      </section>

      <Modal
        open={nueva !== null}
        onOpenChange={(o) => !ocupado && !o && setNueva(null)}
        title="Nueva orden de compra"
        description="Los costos son netos por unidad. Puedes guardarla como borrador o enviarla ya."
      >
        {nueva && (
          <div className={g.form}>
            {error && (
              <p className={g.error} role="alert">
                {error}
              </p>
            )}
            <div className={g.campos}>
              <label htmlFor={`${id}-prov`}>
                Proveedor
                <select
                  id={`${id}-prov`}
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
              <label htmlFor={`${id}-fecha`}>
                Fecha esperada (opcional)
                <input
                  id={`${id}-fecha`}
                  type="date"
                  value={nueva.fechaEsperada}
                  onChange={(e) =>
                    setNueva({ ...nueva, fechaEsperada: e.target.value })
                  }
                />
              </label>
            </div>
            <table className={g.tabla}>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th className={g.num}>Cantidad</th>
                  <th className={g.num}>Costo unit.</th>
                  <th aria-label="Quitar" />
                </tr>
              </thead>
              <tbody>
                {nueva.lineas.map((l, i) => {
                  const cambiar = (c: Partial<LineaNueva>) =>
                    setNueva({
                      ...nueva,
                      lineas: nueva.lineas.map((x, j) =>
                        j === i ? { ...x, ...c } : x,
                      ),
                    });
                  return (
                    // biome-ignore lint/suspicious/noArrayIndexKey: filas editables sin id propio
                    <tr key={i}>
                      <td>
                        <select
                          className={g.celda}
                          aria-label="Producto"
                          value={l.medicamentoId}
                          onChange={(e) =>
                            cambiar({ medicamentoId: Number(e.target.value) })
                          }
                        >
                          <option value={0}>Selecciona…</option>
                          {productos.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.nombre}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className={g.num}>
                        <input
                          className={g.celda}
                          type="number"
                          min={1}
                          step={1}
                          aria-label="Cantidad"
                          value={l.cantidad}
                          onChange={(e) =>
                            cambiar({ cantidad: e.target.value })
                          }
                        />
                      </td>
                      <td className={g.num}>
                        <input
                          className={g.celda}
                          type="number"
                          min={0}
                          step={1}
                          aria-label="Costo unitario"
                          value={l.costo}
                          onChange={(e) => cambiar({ costo: e.target.value })}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className={g.peligro}
                          aria-label="Quitar línea"
                          disabled={nueva.lineas.length === 1}
                          onClick={() =>
                            setNueva({
                              ...nueva,
                              lineas: nueva.lineas.filter((_, j) => j !== i),
                            })
                          }
                        >
                          <Trash2 aria-hidden size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <button
              type="button"
              className={g.boton}
              onClick={() =>
                setNueva({
                  ...nueva,
                  lineas: [
                    ...nueva.lineas,
                    { medicamentoId: 0, cantidad: "", costo: "" },
                  ],
                })
              }
            >
              <Plus aria-hidden size={14} /> Agregar producto
            </button>
            <div className={g.total}>
              <span>Total neto</span>
              <span>
                {clp(
                  nueva.lineas.reduce(
                    (t, l) =>
                      t + Number(l.cantidad || 0) * Number(l.costo || 0),
                    0,
                  ),
                )}
              </span>
            </div>
            <label htmlFor={`${id}-obs`}>
              Observaciones
              <textarea
                id={`${id}-obs`}
                rows={2}
                maxLength={300}
                value={nueva.observaciones}
                onChange={(e) =>
                  setNueva({ ...nueva, observaciones: e.target.value })
                }
              />
            </label>
            <div className={g.acciones}>
              <button
                type="button"
                className={g.boton}
                disabled={ocupado}
                onClick={() => crearOrden(false)}
              >
                Guardar borrador
              </button>
              <button
                type="button"
                className={g.primario}
                disabled={ocupado}
                onClick={() => crearOrden(true)}
              >
                <Send aria-hidden size={14} /> Crear y enviar
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={recibir !== null}
        onOpenChange={(o) => !ocupado && !o && setRecibir(null)}
        title={`Recibir orden #${recibir?.id ?? ""}`}
        description="Ingresa lo que llegó en buen estado con su lote y vencimiento, y lo que rechazas con su motivo."
      >
        {recibir && (
          <div className={g.form}>
            {error && (
              <p className={g.error} role="alert">
                {error}
              </p>
            )}
            <label htmlFor={`${id}-ubic`}>
              Ubicación de destino
              <select
                id={`${id}-ubic`}
                value={ubicacionId}
                onChange={(e) => setUbicacionId(Number(e.target.value))}
              >
                {ubicaciones.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre}
                  </option>
                ))}
              </select>
            </label>
            <div className={g.scroll}>
              <table className={g.tabla}>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th className={g.num}>Aceptadas</th>
                    <th>Lote</th>
                    <th>Vence</th>
                    <th className={g.num}>Rechazadas</th>
                    <th>Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {recibir.items
                    .filter((i) => pendiente(i) > 0)
                    .map((i) => {
                      const l = recepcion[i.id];
                      const cambiar = (c: Partial<LineaRecepcion>) =>
                        setRecepcion({ ...recepcion, [i.id]: { ...l, ...c } });
                      return (
                        <tr key={i.id}>
                          <td>
                            {i.producto}
                            <small>Pendientes: {pendiente(i)}</small>
                          </td>
                          <td className={g.num}>
                            <input
                              className={g.celda}
                              type="number"
                              min={0}
                              max={pendiente(i)}
                              aria-label={`Aceptadas de ${i.producto}`}
                              value={l.aceptada}
                              onChange={(e) =>
                                cambiar({ aceptada: e.target.value })
                              }
                            />
                          </td>
                          <td>
                            <input
                              className={g.celda}
                              aria-label={`Lote de ${i.producto}`}
                              maxLength={60}
                              value={l.numeroLote}
                              onChange={(e) =>
                                cambiar({ numeroLote: e.target.value })
                              }
                            />
                          </td>
                          <td>
                            <input
                              className={g.celda}
                              type="date"
                              aria-label={`Vencimiento de ${i.producto}`}
                              value={l.vencimiento}
                              onChange={(e) =>
                                cambiar({ vencimiento: e.target.value })
                              }
                            />
                          </td>
                          <td className={g.num}>
                            <input
                              className={g.celda}
                              type="number"
                              min={0}
                              aria-label={`Rechazadas de ${i.producto}`}
                              value={l.rechazada}
                              onChange={(e) =>
                                cambiar({ rechazada: e.target.value })
                              }
                            />
                          </td>
                          <td>
                            <select
                              className={g.celda}
                              aria-label={`Motivo de rechazo de ${i.producto}`}
                              value={l.motivoRechazo}
                              disabled={!Number(l.rechazada)}
                              onChange={(e) =>
                                cambiar({
                                  motivoRechazo: e.target
                                    .value as MotivoRechazo,
                                })
                              }
                            >
                              <option value="">—</option>
                              {Object.entries(MOTIVOS_RECHAZO).map(([k, v]) => (
                                <option key={k} value={k}>
                                  {v}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            <p className={g.nota}>
              Lo que no ingreses queda pendiente para una próxima recepción.
            </p>
            <button
              type="button"
              className={g.primario}
              disabled={ocupado}
              onClick={confirmarRecepcion}
            >
              <PackageCheck aria-hidden size={16} /> Confirmar recepción
            </button>
          </div>
        )}
      </Modal>
    </section>
  );
}

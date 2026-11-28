"use client";

import { Undo2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import g from "@/components/gestion.module.css";
import { enviar } from "@/lib/client-api";
import {
  MOTIVOS_RECHAZO,
  type MotivoRechazo,
} from "@/lib/validation/abastecimiento";

type Rechazo = {
  id: number;
  fecha: string;
  ordenId: number | null;
  proveedorId: number;
  proveedor: string;
  producto: string;
  lote: string;
  cantidad: number;
  motivo: string;
  detalle: string;
  estado: string;
  devolucionId: number | null;
};

export function Rechazados({ rechazos }: { rechazos: Rechazo[] }) {
  const router = useRouter();
  const [filtro, setFiltro] = useState<"PENDIENTE" | "DEVUELTO" | "TODOS">(
    "PENDIENTE",
  );
  const [seleccion, setSeleccion] = useState<number[]>([]);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const lista = rechazos.filter(
    (r) => filtro === "TODOS" || r.estado === filtro,
  );
  const elegidos = rechazos.filter((r) => seleccion.includes(r.id));
  const proveedorElegido = elegidos[0]?.proveedorId;
  const pendientes = rechazos.filter((r) => r.estado === "PENDIENTE");

  async function devolver() {
    setOcupado(true);
    setError("");
    try {
      const r = await enviar<{ id: number }>(
        "/api/privada/devoluciones",
        "POST",
        {
          proveedorId: proveedorElegido,
          motivo: "RECHAZADO",
          rechazoIds: seleccion,
        },
      );
      setAviso(
        `Devolución #${r.id} emitida a ${elegidos[0].proveedor} con ${elegidos.length} productos.`,
      );
      setSeleccion([]);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de conexión.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="pos-shell">
      <header className="pos-header">
        <div>
          <h1>Productos Rechazados</h1>
          <span>
            Lo que no se aceptó al recibir una compra. Selecciona rechazos del
            mismo proveedor para devolvérselos.
          </span>
        </div>
      </header>
      <div className="pos-metrics">
        <div>
          <small>Por devolver</small>
          <strong>{pendientes.length}</strong>
        </div>
        <div>
          <small>Unidades por devolver</small>
          <strong>{pendientes.reduce((t, r) => t + r.cantidad, 0)}</strong>
        </div>
        <div>
          <small>Proveedores con rechazos</small>
          <strong>{new Set(pendientes.map((r) => r.proveedorId)).size}</strong>
        </div>
        <div>
          <small>Ya devueltos</small>
          <strong>
            {rechazos.filter((r) => r.estado === "DEVUELTO").length}
          </strong>
        </div>
      </div>
      {aviso && (
        <p className={g.ok} role="status">
          {aviso}{" "}
          <Link href="/privada/devoluciones-a-proveedor">Ver devoluciones</Link>
        </p>
      )}
      {error && (
        <p className={g.error} role="alert">
          {error}
        </p>
      )}
      <section className="pos-panel">
        <div className={g.barra}>
          <div className={g.segmento} role="group" aria-label="Estado">
            {(["PENDIENTE", "DEVUELTO", "TODOS"] as const).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filtro === f}
                onClick={() => setFiltro(f)}
              >
                {f === "PENDIENTE"
                  ? "Por devolver"
                  : f === "DEVUELTO"
                    ? "Devueltos"
                    : "Todos"}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={g.primario}
            disabled={!seleccion.length || ocupado}
            onClick={devolver}
          >
            <Undo2 aria-hidden size={16} />
            Devolver {seleccion.length || ""} al proveedor
          </button>
        </div>
        {lista.length ? (
          <div className={g.scroll}>
            <table className={g.tabla}>
              <thead>
                <tr>
                  <th aria-label="Seleccionar" />
                  <th>Fecha</th>
                  <th>Producto</th>
                  <th>Proveedor</th>
                  <th className={g.num}>Unidades</th>
                  <th>Motivo</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((r) => {
                  const bloqueado =
                    r.estado !== "PENDIENTE" ||
                    (proveedorElegido !== undefined &&
                      proveedorElegido !== r.proveedorId);
                  return (
                    <tr key={r.id}>
                      <td>
                        {r.estado === "PENDIENTE" && (
                          <input
                            type="checkbox"
                            aria-label={`Seleccionar rechazo ${r.id}`}
                            disabled={bloqueado}
                            title={
                              bloqueado
                                ? "Solo se agrupan rechazos del mismo proveedor"
                                : undefined
                            }
                            checked={seleccion.includes(r.id)}
                            onChange={(e) =>
                              setSeleccion((s) =>
                                e.target.checked
                                  ? [...s, r.id]
                                  : s.filter((x) => x !== r.id),
                              )
                            }
                          />
                        )}
                      </td>
                      <td>
                        {r.fecha}
                        {r.ordenId && <small>Orden #{r.ordenId}</small>}
                      </td>
                      <td>
                        {r.producto}
                        {r.lote && <small>Lote {r.lote}</small>}
                      </td>
                      <td>{r.proveedor}</td>
                      <td className={g.num}>{r.cantidad}</td>
                      <td>
                        {MOTIVOS_RECHAZO[r.motivo as MotivoRechazo] ?? r.motivo}
                        {r.detalle && <small>{r.detalle}</small>}
                      </td>
                      <td>
                        <span
                          className={g.estado}
                          data-tono={r.estado === "PENDIENTE" ? "alerta" : "ok"}
                        >
                          {r.estado === "PENDIENTE"
                            ? "Por devolver"
                            : `Devuelto #${r.devolucionId}`}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="pos-empty">
            {filtro === "PENDIENTE"
              ? "No hay rechazos pendientes. Se registran al recibir una orden en Compras."
              : "No hay rechazos en este filtro."}
          </p>
        )}
      </section>
    </section>
  );
}

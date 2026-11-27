"use client";

import { AlertTriangle, CheckCircle2, PenLine } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Modal } from "@/components/ui/modal";
import type {
  RegistroLibro,
  ResumenControlado,
} from "@/lib/private/controlados";
import styles from "./libro-controlados.module.css";

const etiquetaTipo: Record<string, string> = {
  APERTURA: "Apertura",
  ENTRADA: "Entrada",
  SALIDA: "Salida",
  AJUSTE: "Ajuste",
};
const condicion = (c: string) =>
  c === "RECETA_CHEQUE" ? "Estupefaciente (cheque)" : "Psicotrópico (retenida)";

async function enviar(url: string, body: unknown) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error ?? "No se pudo completar la acción.");
  return data;
}

export function LibroControlados({
  resumen,
  registros,
  filtro,
  puedeFirmar,
}: {
  resumen: ResumenControlado[];
  registros: RegistroLibro[];
  filtro: { medicamentoId?: number; soloPendientes: boolean };
  puedeFirmar: boolean;
}) {
  const router = useRouter();
  const id = useId();
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string }>();
  const [ocupado, setOcupado] = useState(false);
  const [seleccion, setSeleccion] = useState<number[]>([]);
  const [firmando, setFirmando] = useState(false);
  const [password, setPassword] = useState("");
  const [movimiento, setMovimiento] = useState<{
    medicamentoId: number;
    nombre: string;
  } | null>(null);
  const [tipoMov, setTipoMov] = useState<"ENTRADA" | "AJUSTE">("ENTRADA");
  const [cantidad, setCantidad] = useState("");
  const [detalle, setDetalle] = useState("");

  const descuadres = resumen.filter((r) => r.diferencia);
  const pendientes = resumen.reduce((n, r) => n + r.pendientesFirma, 0);
  const sinFirmar = registros.filter((r) => !r.firmadoEn);

  async function accion(fn: () => Promise<string>) {
    setOcupado(true);
    setMensaje(undefined);
    try {
      setMensaje({ ok: true, texto: await fn() });
      router.refresh();
      return true;
    } catch (e) {
      setMensaje({
        ok: false,
        texto: e instanceof Error ? e.message : "Error de conexión.",
      });
      return false;
    } finally {
      setOcupado(false);
    }
  }

  const filtroHref = (cambios: Partial<typeof filtro>) => {
    const f = { ...filtro, ...cambios };
    const q = new URLSearchParams();
    if (f.medicamentoId) q.set("medicamento", String(f.medicamentoId));
    if (f.soloPendientes) q.set("pendientes", "1");
    return `/privada/libro-controlados${q.size ? `?${q}` : ""}`;
  };

  return (
    <section className="pos-shell">
      <header className="pos-header">
        <div>
          <h1>Libro de Controlados</h1>
          <span>
            Libro oficial digital de estupefacientes y psicotrópicos (ISP). Las
            ventas con receta retenida o cheque se anotan solas.
          </span>
        </div>
      </header>

      <div className="pos-metrics">
        <div>
          <small>Medicamentos controlados</small>
          <strong>{resumen.length}</strong>
        </div>
        <div>
          <small>Descuadres libro vs. stock</small>
          <strong className={descuadres.length ? styles.alerta : undefined}>
            {descuadres.length}
          </strong>
        </div>
        <div>
          <small>Registros sin firmar</small>
          <strong>{pendientes}</strong>
        </div>
        <div>
          <small>Libros sin abrir</small>
          <strong>{resumen.filter((r) => r.saldoLibro === null).length}</strong>
        </div>
      </div>

      {descuadres.length > 0 && (
        <div className={styles.banner} role="alert">
          <AlertTriangle aria-hidden size={20} />
          <div>
            <b>Descuadre detectado.</b> El stock físico de{" "}
            {descuadres.map((d) => d.nombre).join(", ")} no coincide con el
            saldo del libro. Revisa movimientos no registrados y regulariza con
            un ajuste firmado.
          </div>
        </div>
      )}

      {mensaje && (
        <p
          className={mensaje.ok ? styles.ok : styles.error}
          role={mensaje.ok ? "status" : "alert"}
        >
          {mensaje.texto}
        </p>
      )}

      <section className="pos-panel">
        <div className="pos-title">
          <div>
            <small>SALDOS</small>
            <h2>Resumen por medicamento</h2>
          </div>
        </div>
        {resumen.length ? (
          <div className={styles.tablaScroll}>
            <table className={styles.tabla}>
              <thead>
                <tr>
                  <th>Medicamento</th>
                  <th>Clase</th>
                  <th className={styles.num}>Saldo libro</th>
                  <th className={styles.num}>Stock físico</th>
                  <th className={styles.num}>Diferencia</th>
                  <th className={styles.num}>Sin firmar</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {resumen.map((r) => (
                  <tr key={r.medicamentoId}>
                    <td>
                      <Link
                        href={filtroHref({ medicamentoId: r.medicamentoId })}
                      >
                        {r.nombre}
                      </Link>
                    </td>
                    <td>{condicion(r.condicion)}</td>
                    <td className={styles.num}>{r.saldoLibro ?? "—"}</td>
                    <td className={styles.num}>{r.stockReal}</td>
                    <td
                      className={`${styles.num} ${r.diferencia ? styles.alerta : ""}`}
                    >
                      {r.diferencia === null
                        ? "—"
                        : r.diferencia > 0
                          ? `+${r.diferencia}`
                          : r.diferencia}
                    </td>
                    <td className={styles.num}>{r.pendientesFirma}</td>
                    <td>
                      {puedeFirmar &&
                        (r.saldoLibro === null ? (
                          <button
                            type="button"
                            className={styles.boton}
                            disabled={ocupado}
                            onClick={() =>
                              accion(async () => {
                                await enviar("/api/privada/libro-controlados", {
                                  tipo: "APERTURA",
                                  medicamentoId: r.medicamentoId,
                                });
                                return `Libro de ${r.nombre} abierto con ${r.stockReal} unidades.`;
                              })
                            }
                          >
                            Abrir libro
                          </button>
                        ) : (
                          <button
                            type="button"
                            className={styles.boton}
                            disabled={ocupado}
                            onClick={() => {
                              setMovimiento({
                                medicamentoId: r.medicamentoId,
                                nombre: r.nombre,
                              });
                              setTipoMov(r.diferencia ? "AJUSTE" : "ENTRADA");
                              setCantidad(
                                r.diferencia ? String(r.diferencia) : "",
                              );
                              setDetalle("");
                              setMensaje(undefined);
                            }}
                          >
                            Registrar movimiento
                          </button>
                        ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="pos-empty">
            No hay medicamentos con condición de venta «receta retenida» o
            «receta cheque». Clasifícalos en Productos y Empaques.
          </p>
        )}
      </section>

      <section className="pos-panel">
        <div className="pos-title">
          <div>
            <small>REGISTROS</small>
            <h2>
              Movimientos
              {filtro.medicamentoId
                ? ` · ${resumen.find((r) => r.medicamentoId === filtro.medicamentoId)?.nombre ?? ""}`
                : ""}
            </h2>
          </div>
          <div className={styles.filtros}>
            <Link href={filtroHref({ soloPendientes: !filtro.soloPendientes })}>
              {filtro.soloPendientes ? "Ver todos" : "Solo sin firmar"}
            </Link>
            {filtro.medicamentoId && (
              <Link href={filtroHref({ medicamentoId: undefined })}>
                Todos los medicamentos
              </Link>
            )}
          </div>
        </div>
        {puedeFirmar && sinFirmar.length > 0 && (
          <div className={styles.acciones}>
            <button
              type="button"
              className={styles.boton}
              onClick={() =>
                setSeleccion(
                  seleccion.length === sinFirmar.length
                    ? []
                    : sinFirmar.map((r) => r.id),
                )
              }
            >
              {seleccion.length === sinFirmar.length
                ? "Quitar selección"
                : "Seleccionar pendientes"}
            </button>
            <button
              type="button"
              className={styles.botonPrimario}
              disabled={!seleccion.length || ocupado}
              onClick={() => {
                setPassword("");
                setMensaje(undefined);
                setFirmando(true);
              }}
            >
              <PenLine aria-hidden size={16} />
              Firmar {seleccion.length || ""} seleccionados
            </button>
          </div>
        )}
        {registros.length ? (
          <div className={styles.tablaScroll}>
            <table className={styles.tabla}>
              <thead>
                <tr>
                  {puedeFirmar && <th aria-label="Seleccionar" />}
                  <th>N°</th>
                  <th>Fecha</th>
                  <th>Medicamento</th>
                  <th>Tipo</th>
                  <th className={styles.num}>Cantidad</th>
                  <th className={styles.num}>Saldo</th>
                  <th>Detalle / receta</th>
                  <th>Registró</th>
                  <th>Firma Q.F.</th>
                </tr>
              </thead>
              <tbody>
                {registros.map((r) => (
                  <tr key={r.id}>
                    {puedeFirmar && (
                      <td>
                        {!r.firmadoEn && (
                          <input
                            type="checkbox"
                            aria-label={`Seleccionar registro ${r.id}`}
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
                    )}
                    <td>{r.id}</td>
                    <td>{r.fecha}</td>
                    <td>{r.medicamento}</td>
                    <td>{etiquetaTipo[r.tipo] ?? r.tipo}</td>
                    <td className={styles.num}>
                      {r.tipo === "SALIDA" ? `−${r.cantidad}` : r.cantidad}
                    </td>
                    <td className={styles.num}>{r.saldo}</td>
                    <td>
                      {r.ventaId ? (
                        <Link
                          href={`/privada/historial-y-reportes/${r.ventaId}`}
                        >
                          {r.detalle}
                        </Link>
                      ) : (
                        r.detalle
                      )}
                      {r.receta && (
                        <small className={styles.receta}>
                          {r.receta.tipo === "CHEQUE" ? "Cheque" : "Retenida"}{" "}
                          {r.receta.folio} · Paciente {r.receta.pacienteRut} ·
                          Dr(a). {r.receta.medicoNombre}
                        </small>
                      )}
                    </td>
                    <td>{r.registradoPor ?? "—"}</td>
                    <td>
                      {r.firmadoEn ? (
                        <span className={styles.firmado}>
                          <CheckCircle2 aria-hidden size={14} />
                          {r.firmadoPor} · {r.firmadoEn}
                        </span>
                      ) : (
                        <span className={styles.pendiente}>Pendiente</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="pos-empty">Sin movimientos registrados.</p>
        )}
        <p className="pos-footnote">
          Se muestran los últimos 200 registros. Exporta el libro completo desde
          Historial y Reportes.
        </p>
      </section>

      <Modal
        open={firmando}
        onOpenChange={(open) => !ocupado && setFirmando(open)}
        title="Firmar registros del libro"
        description={`Confirmas con tu contraseña que revisaste ${seleccion.length} registros.`}
      >
        <form
          className={styles.modalForm}
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await accion(async () => {
              const r = await enviar("/api/privada/libro-controlados/firmar", {
                ids: seleccion,
                password,
              });
              return `${r.firmados} registros firmados.`;
            });
            if (ok) {
              setSeleccion([]);
              setFirmando(false);
            }
            setPassword("");
          }}
        >
          {mensaje && !mensaje.ok && (
            <p className={styles.error} role="alert">
              {mensaje.texto}
            </p>
          )}
          <label htmlFor={`${id}-pass`}>
            Contraseña
            <input
              id={`${id}-pass`}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <button
            type="submit"
            className={styles.botonPrimario}
            disabled={ocupado || !password}
          >
            Firmar
          </button>
        </form>
      </Modal>

      <Modal
        open={movimiento !== null}
        onOpenChange={(open) => !ocupado && !open && setMovimiento(null)}
        title={`Registrar movimiento · ${movimiento?.nombre ?? ""}`}
        description="Las entradas suman al saldo; los ajustes pueden ser positivos o negativos y exigen motivo."
      >
        <form
          className={styles.modalForm}
          onSubmit={async (e) => {
            e.preventDefault();
            if (!movimiento) return;
            const ok = await accion(async () => {
              const r = await enviar("/api/privada/libro-controlados", {
                tipo: tipoMov,
                medicamentoId: movimiento.medicamentoId,
                cantidad: Number(cantidad),
                detalle,
              });
              return `Movimiento registrado. Nuevo saldo del libro: ${r.saldo}.`;
            });
            if (ok) setMovimiento(null);
          }}
        >
          {mensaje && !mensaje.ok && (
            <p className={styles.error} role="alert">
              {mensaje.texto}
            </p>
          )}
          <label htmlFor={`${id}-tipo`}>
            Tipo
            <select
              id={`${id}-tipo`}
              value={tipoMov}
              onChange={(e) =>
                setTipoMov(e.target.value as "ENTRADA" | "AJUSTE")
              }
            >
              <option value="ENTRADA">Entrada (recepción)</option>
              <option value="AJUSTE">Ajuste (regularización)</option>
            </select>
          </label>
          <label htmlFor={`${id}-cantidad`}>
            Cantidad {tipoMov === "AJUSTE" ? "(usa − para restar)" : ""}
            <input
              id={`${id}-cantidad`}
              type="number"
              step={1}
              min={tipoMov === "ENTRADA" ? 1 : undefined}
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              required
            />
          </label>
          <label htmlFor={`${id}-detalle`}>
            Motivo / documento de respaldo
            <textarea
              id={`${id}-detalle`}
              rows={3}
              maxLength={300}
              value={detalle}
              onChange={(e) => setDetalle(e.target.value)}
              required
            />
          </label>
          <button
            type="submit"
            className={styles.botonPrimario}
            disabled={ocupado || !cantidad || detalle.trim().length < 5}
          >
            Registrar
          </button>
        </form>
      </Modal>
    </section>
  );
}

"use client";

import { Lock, LogIn, MinusCircle, PlusCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import g from "@/components/gestion.module.css";
import { clp, enviar } from "@/lib/client-api";
import type { TurnoActual } from "@/lib/private/abastecimiento";

type Cierre = {
  id: number;
  usuario: string;
  abiertoEn: string;
  cerradoEn: string;
  esperado: number;
  contado: number;
  diferencia: number;
  observaciones: string | null;
};
// Hora de Chile armada a mano: igual en servidor y navegador (sin ICU ni zona local).
const partes = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Santiago",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const hora = (iso: string) => {
  const p = Object.fromEntries(
    partes.formatToParts(new Date(iso)).map((x) => [x.type, x.value]),
  );
  return `${p.day}/${p.month} ${p.hour}:${p.minute}`;
};

export function TurnoCaja({
  turno,
  historial,
  puedeOperar,
}: {
  turno: TurnoActual | null;
  historial: Cierre[];
  puedeOperar: boolean;
}) {
  const router = useRouter();
  const id = useId();
  const [monto, setMonto] = useState("");
  const [mov, setMov] = useState({
    tipo: "INGRESO" as "INGRESO" | "EGRESO",
    monto: "",
    motivo: "",
  });
  const [contado, setContado] = useState("");
  const [obs, setObs] = useState("");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function caja(
    body: Record<string, unknown>,
    texto: (r: Record<string, number>) => string,
  ) {
    setOcupado(true);
    setError("");
    setAviso("");
    try {
      const r = await enviar<Record<string, number>>(
        "/api/privada/caja",
        "POST",
        body,
      );
      setAviso(texto(r));
      router.refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de conexión.");
      return false;
    } finally {
      setOcupado(false);
    }
  }

  const diferenciaPrevia =
    turno && contado !== "" ? Number(contado) - turno.esperado : null;

  return (
    <section className="pos-panel">
      <div className="pos-title">
        <div>
          <small>MI TURNO</small>
          <h2>{turno ? "Caja abierta" : "Caja cerrada"}</h2>
        </div>
        {turno && <span>Desde {hora(turno.abiertoEn)}</span>}
      </div>
      {aviso && (
        <p className={g.ok} role="status">
          {aviso}
        </p>
      )}
      {error && (
        <p className={g.error} role="alert">
          {error}
        </p>
      )}
      {!puedeOperar ? (
        <p className="pos-empty">Tu rol no tiene permiso de caja.</p>
      ) : !turno ? (
        <form
          className={g.form}
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              await caja(
                { accion: "ABRIR", montoInicial: Number(monto || 0) },
                () =>
                  "Turno abierto. Las ventas en efectivo se suman al arqueo.",
              )
            )
              setMonto("");
          }}
        >
          <label htmlFor={`${id}-ini`}>
            Fondo inicial en efectivo (CLP)
            <input
              id={`${id}-ini`}
              type="number"
              min={0}
              step={1}
              value={monto}
              placeholder="0"
              onChange={(e) => setMonto(e.target.value)}
            />
          </label>
          <button type="submit" className={g.primario} disabled={ocupado}>
            <LogIn aria-hidden size={16} /> Abrir turno
          </button>
        </form>
      ) : (
        <div className={g.form}>
          <div className="pos-total">
            <span>Fondo inicial</span>
            <strong>{clp(turno.montoInicial)}</strong>
          </div>
          <div className="pos-total">
            <span>Ventas en efectivo · {turno.cantidadVentas}</span>
            <strong>+{clp(turno.ventasEfectivo)}</strong>
          </div>
          <div className="pos-total">
            <span>Ingresos manuales</span>
            <strong>+{clp(turno.ingresos)}</strong>
          </div>
          <div className="pos-total">
            <span>Retiros</span>
            <strong>−{clp(turno.egresos)}</strong>
          </div>
          <div className={g.total}>
            <span>Efectivo esperado</span>
            <span>{clp(turno.esperado)}</span>
          </div>

          <form
            className={g.form}
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await caja(
                  {
                    accion: "MOVIMIENTO",
                    tipo: mov.tipo,
                    monto: Number(mov.monto),
                    motivo: mov.motivo,
                  },
                  () =>
                    `${mov.tipo === "INGRESO" ? "Ingreso" : "Retiro"} de ${clp(Number(mov.monto))} registrado.`,
                )
              )
                setMov({ ...mov, monto: "", motivo: "" });
            }}
          >
            <div
              className={g.segmento}
              role="group"
              aria-label="Tipo de movimiento"
            >
              <button
                type="button"
                aria-pressed={mov.tipo === "INGRESO"}
                onClick={() => setMov({ ...mov, tipo: "INGRESO" })}
              >
                <PlusCircle aria-hidden size={13} /> Ingreso
              </button>
              <button
                type="button"
                aria-pressed={mov.tipo === "EGRESO"}
                onClick={() => setMov({ ...mov, tipo: "EGRESO" })}
              >
                <MinusCircle aria-hidden size={13} /> Retiro
              </button>
            </div>
            <div className={g.campos}>
              <label htmlFor={`${id}-mm`}>
                Monto
                <input
                  id={`${id}-mm`}
                  type="number"
                  min={1}
                  value={mov.monto}
                  onChange={(e) => setMov({ ...mov, monto: e.target.value })}
                />
              </label>
              <label htmlFor={`${id}-mo`}>
                Motivo
                <input
                  id={`${id}-mo`}
                  maxLength={160}
                  value={mov.motivo}
                  placeholder="Ej. Sencillo, pago a proveedor"
                  onChange={(e) => setMov({ ...mov, motivo: e.target.value })}
                />
              </label>
            </div>
            <button
              type="submit"
              className={g.boton}
              disabled={ocupado || !mov.monto || !mov.motivo}
            >
              Registrar movimiento
            </button>
          </form>

          {turno.movimientos.length > 0 && (
            <ul className={g.form} aria-label="Movimientos del turno">
              {turno.movimientos.map((m) => (
                <li key={m.id} className="pos-total">
                  <span>
                    {hora(m.creadoEn)} · {m.motivo}
                  </span>
                  <strong>
                    {m.tipo === "INGRESO" ? "+" : "−"}
                    {clp(m.monto)}
                  </strong>
                </li>
              ))}
            </ul>
          )}

          <form
            className={g.form}
            onSubmit={async (e) => {
              e.preventDefault();
              if (!window.confirm("¿Cerrar el turno con este arqueo?")) return;
              if (
                await caja(
                  {
                    accion: "CERRAR",
                    montoContado: Number(contado),
                    observaciones: obs,
                  },
                  (r) =>
                    r.diferencia === 0
                      ? "Turno cerrado: la caja cuadra."
                      : `Turno cerrado con ${r.diferencia > 0 ? "sobrante" : "faltante"} de ${clp(Math.abs(r.diferencia))}.`,
                )
              ) {
                setContado("");
                setObs("");
              }
            }}
          >
            <label htmlFor={`${id}-c`}>
              Efectivo contado al cierre
              <input
                id={`${id}-c`}
                type="number"
                min={0}
                value={contado}
                onChange={(e) => setContado(e.target.value)}
              />
            </label>
            {diferenciaPrevia !== null && (
              <p
                className={diferenciaPrevia === 0 ? g.ok : g.error}
                role="status"
              >
                {diferenciaPrevia === 0
                  ? "Cuadra con lo esperado."
                  : `${diferenciaPrevia > 0 ? "Sobrante" : "Faltante"} de ${clp(Math.abs(diferenciaPrevia))}.`}
              </p>
            )}
            <label htmlFor={`${id}-o`}>
              Observaciones
              <input
                id={`${id}-o`}
                maxLength={300}
                value={obs}
                onChange={(e) => setObs(e.target.value)}
              />
            </label>
            <button
              type="submit"
              className={g.primario}
              disabled={ocupado || contado === ""}
            >
              <Lock aria-hidden size={16} /> Cerrar turno
            </button>
          </form>
        </div>
      )}
      {historial.length > 0 && (
        <>
          <div className="pos-title">
            <h2>Últimos cierres</h2>
          </div>
          <table className={g.tabla}>
            <thead>
              <tr>
                <th>Turno</th>
                <th className={g.num}>Esperado</th>
                <th className={g.num}>Contado</th>
                <th className={g.num}>Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {historial.map((h) => (
                <tr key={h.id}>
                  <td>
                    {h.usuario}
                    <small>
                      {hora(h.abiertoEn)} → {hora(h.cerradoEn)}
                    </small>
                  </td>
                  <td className={g.num}>{clp(h.esperado)}</td>
                  <td className={g.num}>{clp(h.contado)}</td>
                  <td className={g.num}>
                    <span
                      className={g.estado}
                      data-tono={h.diferencia === 0 ? "ok" : "peligro"}
                    >
                      {h.diferencia > 0 ? "+" : h.diferencia < 0 ? "−" : ""}
                      {clp(Math.abs(h.diferencia))}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}

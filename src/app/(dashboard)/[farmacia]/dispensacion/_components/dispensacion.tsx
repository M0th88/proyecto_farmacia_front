"use client";

import { CheckCircle2, Search, UserRound } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";
import type { FichaPaciente } from "@/lib/asistencial/dispensacion";
import { formatRut } from "@/lib/user-input";
import {
  dispensacionSchema,
  etiquetaTipoPrograma,
  parentescos,
  problemaRecetaAsistencial,
  textoPrevision,
  VIGENCIA_RECETA_DIAS,
} from "@/lib/validation/dispensacion";
import { hoyChile } from "@/lib/validation/recetas";
import styles from "./dispensacion.module.css";

type Receta = {
  folio: string;
  medicoRut: string;
  medicoNombre: string;
  fecha: string;
};
type Retira = { rut: string; nombre: string; parentesco: string };

export function Dispensacion({
  fichaInicial = null,
}: {
  fichaInicial?: FichaPaciente | null;
}) {
  const id = useId();
  const [rut, setRut] = useState(fichaInicial?.rut ?? "");
  const [ficha, setFicha] = useState<FichaPaciente | null>(fichaInicial);
  const [programaId, setProgramaId] = useState(
    fichaInicial?.programas.find((p) => p.vigente)?.id ?? 0,
  );
  const [cantidades, setCantidades] = useState<Record<number, string>>({});
  const [receta, setReceta] = useState<Receta>({
    folio: "",
    medicoRut: "",
    medicoNombre: "",
    fecha: hoyChile(),
  });
  const [tercero, setTercero] = useState(false);
  const [retira, setRetira] = useState<Retira>({
    rut: "",
    nombre: "",
    parentesco: "",
  });
  const [observaciones, setObservaciones] = useState("");
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [clave, setClave] = useState(() => crypto.randomUUID());

  async function buscar(rutBuscado = rut) {
    setOcupado(true);
    setError("");
    try {
      const r = await fetch(
        `/api/asistencial/pacientes?rut=${encodeURIComponent(rutBuscado)}`,
        { cache: "no-store" },
      );
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error ?? "No se pudo buscar.");
      const f = data as FichaPaciente;
      setFicha(f);
      setProgramaId(
        (current) =>
          f.programas.find((p) => p.id === current && p.vigente)?.id ??
          f.programas.find((p) => p.vigente)?.id ??
          0,
      );
      setCantidades({});
    } catch (e) {
      setFicha(null);
      setError(e instanceof Error ? e.message : "Error de conexión.");
    } finally {
      setOcupado(false);
    }
  }

  const programa = ficha?.programas.find((p) => p.id === programaId);
  const items = (programa?.medicamentos ?? [])
    .map((m) => ({
      medicamentoId: m.id,
      cantidad: Number(cantidades[m.id] || 0),
    }))
    .filter((i) => i.cantidad > 0);

  async function confirmar() {
    if (!ficha || !programa) return;
    setError("");
    setExito("");
    const problema = problemaRecetaAsistencial(receta.fecha, hoyChile());
    if (problema) return setError(problema);
    for (const m of programa.medicamentos) {
      const c = Number(cantidades[m.id] || 0);
      if (c > m.cuotaMensual - m.usadoMes)
        return setError(`${m.nombre}: supera la cuota restante del mes.`);
      if (c > m.stock) return setError(`${m.nombre}: no hay stock suficiente.`);
    }
    const parsed = dispensacionSchema.safeParse({
      claveOperacion: clave,
      pacienteRut: ficha.rut,
      programaId: programa.id,
      receta,
      retira: tercero ? retira : undefined,
      observaciones,
      items,
    });
    if (!parsed.success)
      return setError(parsed.error.issues[0]?.message ?? "Revisa los datos.");
    setOcupado(true);
    try {
      const r = await fetch("/api/asistencial/dispensaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error ?? "No se pudo registrar.");
      setExito(
        `Entrega #${data.id} registrada para ${ficha.nombre}${tercero ? `, retirada por ${retira.nombre}` : ""}.`,
      );
      setClave(crypto.randomUUID());
      setTercero(false);
      setRetira({ rut: "", nombre: "", parentesco: "" });
      setObservaciones("");
      await buscar(ficha.rut);
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
          <h1>Dispensación</h1>
          <span>
            Entrega sin costo a pacientes inscritos en programas de salud, con
            control de cuota mensual, receta y salida FEFO.
          </span>
          <nav className="pos-accesos" aria-label="Accesos de dispensación">
            <Link href="/asistencial/pacientes">Pacientes</Link>
            <Link href="/asistencial/programas">Programas</Link>
            <Link href="/asistencial/remesas">Remesas CENABAST</Link>
          </nav>
        </div>
      </header>

      <section className="pos-panel">
        <form
          className={styles.buscar}
          onSubmit={(e) => {
            e.preventDefault();
            if (rut) void buscar();
          }}
        >
          <label htmlFor={`${id}-rut`}>
            RUT del paciente
            <input
              id={`${id}-rut`}
              value={rut}
              placeholder="12.345.678-9"
              autoFocus
              onChange={(e) => setRut(formatRut(e.target.value))}
            />
          </label>
          <button type="submit" disabled={!rut || ocupado}>
            <Search aria-hidden size={16} /> Buscar
          </button>
        </form>
        {exito && (
          <p className={styles.exito} role="status">
            <CheckCircle2 aria-hidden size={18} /> {exito}
          </p>
        )}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </section>

      {ficha && (
        <div className={styles.columnas}>
          <section className="pos-panel">
            <div className={styles.paciente}>
              <UserRound aria-hidden size={28} />
              <div>
                <h2>{ficha.nombre}</h2>
                <small>
                  {ficha.rut} ·{" "}
                  <span
                    className={styles.prevision}
                    data-alerta={ficha.prevision !== "FONASA" || undefined}
                  >
                    {textoPrevision(ficha.prevision, ficha.tramoFonasa)}
                  </span>
                </small>
              </div>
            </div>
            {ficha.prevision !== "FONASA" && (
              <p className={styles.aviso} role="note">
                {ficha.prevision
                  ? "El paciente no es beneficiario Fonasa: confirma su derecho a retiro sin costo en la red pública (por ejemplo, programa GES)."
                  : "Previsión sin registrar: actualízala en Pacientes antes de entregar."}
              </p>
            )}
            {ficha.programas.length ? (
              <div
                className={styles.programas}
                role="radiogroup"
                aria-label="Programa"
              >
                {ficha.programas.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={p.id === programaId}
                    disabled={!p.vigente}
                    onClick={() => {
                      setProgramaId(p.id);
                      setCantidades({});
                    }}
                  >
                    <b>{p.nombre}</b>
                    <small>
                      {etiquetaTipoPrograma[p.tipo]}
                      {!p.vigente && " · Inscripción no vigente"}
                    </small>
                  </button>
                ))}
              </div>
            ) : (
              <p className="pos-empty">
                El paciente no está inscrito en programas.{" "}
                <Link href="/asistencial/pacientes">Inscríbelo aquí</Link>.
              </p>
            )}

            {programa && (
              <table className={styles.tabla}>
                <thead>
                  <tr>
                    <th>Medicamento</th>
                    <th className={styles.num}>Cuota mes</th>
                    <th className={styles.num}>Entregado</th>
                    <th className={styles.num}>Stock</th>
                    <th className={styles.num}>Entregar</th>
                  </tr>
                </thead>
                <tbody>
                  {programa.medicamentos.map((m) => {
                    const restante = Math.max(0, m.cuotaMensual - m.usadoMes);
                    const maximo = Math.min(restante, m.stock);
                    return (
                      <tr key={m.id}>
                        <td>{m.nombre}</td>
                        <td className={styles.num}>{m.cuotaMensual}</td>
                        <td className={styles.num}>{m.usadoMes}</td>
                        <td
                          className={`${styles.num} ${m.stock < restante ? styles.alerta : ""}`}
                        >
                          {m.stock}
                        </td>
                        <td className={styles.num}>
                          <span className={styles.cantidad}>
                            <input
                              type="number"
                              min={0}
                              max={maximo}
                              step={1}
                              aria-label={`Cantidad de ${m.nombre}`}
                              value={cantidades[m.id] ?? ""}
                              placeholder="0"
                              disabled={!maximo}
                              onChange={(e) =>
                                setCantidades({
                                  ...cantidades,
                                  [m.id]: e.target.value,
                                })
                              }
                            />
                            <button
                              type="button"
                              disabled={!maximo}
                              onClick={() =>
                                setCantidades({
                                  ...cantidades,
                                  [m.id]: String(maximo),
                                })
                              }
                            >
                              Cuota
                            </button>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>

          <aside className="pos-panel">
            <fieldset className={styles.grupo} disabled={ocupado}>
              <legend>Receta</legend>
              <label>
                RUT médico
                <input
                  value={receta.medicoRut}
                  placeholder="12.345.678-9"
                  onChange={(e) =>
                    setReceta({
                      ...receta,
                      medicoRut: formatRut(e.target.value),
                    })
                  }
                />
              </label>
              <label>
                Nombre médico
                <input
                  value={receta.medicoNombre}
                  maxLength={120}
                  onChange={(e) =>
                    setReceta({ ...receta, medicoNombre: e.target.value })
                  }
                />
              </label>
              <label>
                Fecha de la receta
                <input
                  type="date"
                  value={receta.fecha}
                  max={hoyChile()}
                  onChange={(e) =>
                    setReceta({ ...receta, fecha: e.target.value })
                  }
                />
              </label>
              <label>
                Folio (opcional)
                <input
                  value={receta.folio}
                  maxLength={40}
                  onChange={(e) =>
                    setReceta({ ...receta, folio: e.target.value })
                  }
                />
              </label>
              <small>
                Vigencia: {VIGENCIA_RECETA_DIAS} días desde su emisión.
              </small>
            </fieldset>

            <fieldset className={styles.grupo} disabled={ocupado}>
              <legend>¿Quién retira?</legend>
              <div className={styles.opciones}>
                <label>
                  <input
                    type="radio"
                    name={`${id}-retira`}
                    checked={!tercero}
                    onChange={() => setTercero(false)}
                  />
                  El titular
                </label>
                <label>
                  <input
                    type="radio"
                    name={`${id}-retira`}
                    checked={tercero}
                    onChange={() => setTercero(true)}
                  />
                  Otra persona
                </label>
              </div>
              {tercero && (
                <>
                  <label>
                    RUT de quien retira
                    <input
                      value={retira.rut}
                      placeholder="12.345.678-9"
                      onChange={(e) =>
                        setRetira({ ...retira, rut: formatRut(e.target.value) })
                      }
                    />
                  </label>
                  <label>
                    Nombre
                    <input
                      value={retira.nombre}
                      maxLength={120}
                      onChange={(e) =>
                        setRetira({ ...retira, nombre: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Parentesco
                    <select
                      value={retira.parentesco}
                      onChange={(e) =>
                        setRetira({ ...retira, parentesco: e.target.value })
                      }
                    >
                      <option value="">Selecciona…</option>
                      {parentescos.map((p) => (
                        <option key={p}>{p}</option>
                      ))}
                    </select>
                  </label>
                </>
              )}
              <label>
                Observaciones
                <textarea
                  rows={2}
                  maxLength={300}
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                />
              </label>
            </fieldset>

            <button
              type="button"
              className="pos-charge"
              disabled={ocupado || !programa || !items.length}
              onClick={confirmar}
            >
              Registrar entrega · {items.reduce((n, i) => n + i.cantidad, 0)}{" "}
              unidades
            </button>
            <p className="pos-footnote">
              Sin costo para el paciente. Se descuentan primero los lotes más
              próximos a vencer.
            </p>
          </aside>
        </div>
      )}

      {ficha && ficha.historial.length > 0 && (
        <section className="pos-panel">
          <div className="pos-title">
            <h2>Últimas entregas</h2>
          </div>
          <table className={styles.tabla}>
            <thead>
              <tr>
                <th>N°</th>
                <th>Fecha</th>
                <th>Programa</th>
                <th>Retiró</th>
                <th>Medicamentos</th>
              </tr>
            </thead>
            <tbody>
              {ficha.historial.map((h) => (
                <tr key={h.id}>
                  <td>{h.id}</td>
                  <td>{h.fecha}</td>
                  <td>{h.programa}</td>
                  <td>{h.retira}</td>
                  <td>{h.detalle}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </section>
  );
}

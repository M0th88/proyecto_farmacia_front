"use client";

import { useId } from "react";
import { formatRut } from "@/lib/user-input";
import {
  etiquetaTipoReceta,
  hoyChile,
  problemaReceta,
  type RecetaInput,
  recetaCubre,
  recetaSchema,
  type TipoReceta,
  tiposReceta,
  vigenciaMaximaDias,
} from "@/lib/validation/recetas";
import styles from "./receta-form.module.css";

export type RecetaBorrador = {
  tipo: TipoReceta;
  origen: "FISICA" | "DIGITAL";
  folio: string;
  pacienteRut: string;
  pacienteNombre: string;
  medicoRut: string;
  medicoNombre: string;
  fechaEmision: string;
  vigenteHasta: string;
  observaciones: string;
};

const sumarDias = (dia: string, dias: number) =>
  new Date(Date.parse(`${dia}T12:00:00Z`) + dias * 86_400_000)
    .toISOString()
    .slice(0, 10);

export function recetaVacia(tipo: TipoReceta): RecetaBorrador {
  const hoy = hoyChile();
  return {
    tipo,
    origen: "FISICA",
    folio: "",
    pacienteRut: "",
    pacienteNombre: "",
    medicoRut: "",
    medicoNombre: "",
    fechaEmision: hoy,
    vigenteHasta: sumarDias(hoy, vigenciaMaximaDias[tipo]),
    observaciones: "",
  };
}

/** Valida el borrador y devuelve la receta lista para enviar o el problema. */
export function validarReceta(
  borrador: RecetaBorrador,
  exigida: TipoReceta,
): { receta: RecetaInput } | { error: string } {
  const parsed = recetaSchema.safeParse(borrador);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? "Revisa la receta." };
  const problema = problemaReceta(parsed.data, exigida, hoyChile());
  return problema ? { error: problema } : { receta: parsed.data };
}

export function RecetaForm({
  exigida,
  value,
  onChange,
  disabled,
}: {
  exigida: TipoReceta;
  value: RecetaBorrador;
  onChange: (value: RecetaBorrador) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const set = <K extends keyof RecetaBorrador>(k: K, v: RecetaBorrador[K]) =>
    onChange({ ...value, [k]: v });
  const retenida = value.tipo !== "SIMPLE";

  return (
    <fieldset className={styles.receta} disabled={disabled}>
      <legend>
        Receta médica
        <span className={styles.exigida}>
          Exige: {etiquetaTipoReceta[exigida]}
        </span>
      </legend>
      <div className={styles.grid}>
        <label htmlFor={`${id}-tipo`}>
          Tipo
          <select
            id={`${id}-tipo`}
            value={value.tipo}
            onChange={(e) => {
              const tipo = e.target.value as TipoReceta;
              onChange({
                ...value,
                tipo,
                vigenteHasta: sumarDias(
                  value.fechaEmision,
                  vigenciaMaximaDias[tipo],
                ),
              });
            }}
          >
            {tiposReceta
              .filter((t) => recetaCubre(t, exigida))
              .map((t) => (
                <option key={t} value={t}>
                  {etiquetaTipoReceta[t]}
                </option>
              ))}
          </select>
        </label>
        <label htmlFor={`${id}-origen`}>
          Formato
          <select
            id={`${id}-origen`}
            value={value.origen}
            onChange={(e) =>
              set("origen", e.target.value as RecetaBorrador["origen"])
            }
          >
            <option value="FISICA">Física</option>
            <option value="DIGITAL">Digital</option>
          </select>
        </label>
        <label htmlFor={`${id}-folio`} className={styles.ancho}>
          Folio {retenida ? "(obligatorio, se retiene)" : "(opcional)"}
          <input
            id={`${id}-folio`}
            value={value.folio}
            maxLength={40}
            required={retenida}
            onChange={(e) => set("folio", e.target.value)}
          />
        </label>
        <label htmlFor={`${id}-prut`}>
          RUT paciente
          <input
            id={`${id}-prut`}
            value={value.pacienteRut}
            inputMode="text"
            placeholder="12.345.678-9"
            onChange={(e) => set("pacienteRut", formatRut(e.target.value))}
          />
        </label>
        <label htmlFor={`${id}-pnom`}>
          Nombre paciente
          <input
            id={`${id}-pnom`}
            value={value.pacienteNombre}
            maxLength={120}
            onChange={(e) => set("pacienteNombre", e.target.value)}
          />
        </label>
        <label htmlFor={`${id}-mrut`}>
          RUT médico
          <input
            id={`${id}-mrut`}
            value={value.medicoRut}
            placeholder="12.345.678-9"
            onChange={(e) => set("medicoRut", formatRut(e.target.value))}
          />
        </label>
        <label htmlFor={`${id}-mnom`}>
          Nombre médico
          <input
            id={`${id}-mnom`}
            value={value.medicoNombre}
            maxLength={120}
            onChange={(e) => set("medicoNombre", e.target.value)}
          />
        </label>
        <label htmlFor={`${id}-emision`}>
          Emisión
          <input
            id={`${id}-emision`}
            type="date"
            value={value.fechaEmision}
            max={hoyChile()}
            onChange={(e) => set("fechaEmision", e.target.value)}
          />
        </label>
        <label htmlFor={`${id}-vigencia`}>
          Vigente hasta
          <input
            id={`${id}-vigencia`}
            type="date"
            value={value.vigenteHasta}
            min={value.fechaEmision}
            onChange={(e) => set("vigenteHasta", e.target.value)}
          />
        </label>
      </div>
      <p className={styles.nota}>
        Vigencia máxima: {vigenciaMaximaDias[value.tipo]} días desde la emisión.
        {retenida &&
          " Los productos controlados quedan anotados en el libro de estupefacientes."}
      </p>
    </fieldset>
  );
}

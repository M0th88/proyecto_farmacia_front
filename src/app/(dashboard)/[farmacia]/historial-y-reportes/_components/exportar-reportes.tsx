"use client";

import { FileSpreadsheet, FileText } from "lucide-react";
import { useId, useState } from "react";
import type { Pharmacy } from "@/lib/auth/pharmacies";
import styles from "./exportar-reportes.module.css";

export type OpcionReporte = {
  tipo: string;
  titulo: string;
  usaFechas: boolean;
};

export function ExportarReportes({
  pharmacy,
  opciones,
  desdeInicial,
  hastaInicial,
}: {
  pharmacy: Pharmacy;
  opciones: OpcionReporte[];
  desdeInicial: string;
  hastaInicial: string;
}) {
  const id = useId();
  const [tipo, setTipo] = useState(opciones[0]?.tipo ?? "");
  const [desde, setDesde] = useState(desdeInicial);
  const [hasta, setHasta] = useState(hastaInicial);
  const actual = opciones.find((o) => o.tipo === tipo);
  if (!actual) return null;

  const rangoInvalido = actual.usaFechas && (!desde || !hasta || desde > hasta);
  const url = (formato: "xlsx" | "pdf") => {
    const q = new URLSearchParams({ formato });
    if (actual.usaFechas) {
      q.set("desde", desde);
      q.set("hasta", hasta);
    }
    return `/api/${pharmacy}/reportes/${tipo}?${q}`;
  };

  return (
    <section className="pos-panel" aria-labelledby={`${id}-titulo`}>
      <div className="pos-title">
        <div>
          <small>RESPALDO ADMINISTRATIVO</small>
          <h2 id={`${id}-titulo`}>Exportar reportes</h2>
        </div>
      </div>
      <div className={styles.controles}>
        <label>
          Reporte
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {opciones.map((o) => (
              <option key={o.tipo} value={o.tipo}>
                {o.titulo}
              </option>
            ))}
          </select>
        </label>
        {actual.usaFechas && (
          <>
            <label>
              Desde
              <input
                type="date"
                value={desde}
                max={hasta || undefined}
                onChange={(e) => setDesde(e.target.value)}
              />
            </label>
            <label>
              Hasta
              <input
                type="date"
                value={hasta}
                min={desde || undefined}
                max={hastaInicial}
                onChange={(e) => setHasta(e.target.value)}
              />
            </label>
          </>
        )}
      </div>
      {rangoInvalido ? (
        <p className={styles.error} role="alert">
          Revisa el rango: la fecha inicial no puede superar a la final.
        </p>
      ) : (
        <div className={styles.acciones}>
          <a className={styles.boton} href={url("xlsx")} download>
            <FileSpreadsheet aria-hidden size={18} />
            Descargar Excel
          </a>
          <a className={styles.boton} href={url("pdf")} download>
            <FileText aria-hidden size={18} />
            Descargar PDF
          </a>
        </div>
      )}
      <p className="pos-footnote">
        {actual.usaFechas
          ? "Usa fechas de Chile; incluye ambos días del rango (máximo un año)."
          : "Refleja las existencias al momento de la descarga."}
      </p>
    </section>
  );
}

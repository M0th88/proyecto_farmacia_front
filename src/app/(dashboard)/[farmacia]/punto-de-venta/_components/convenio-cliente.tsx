"use client";

import { BadgePercent, X } from "lucide-react";
import { useId, useState } from "react";
import { formatRut } from "@/lib/user-input";
import { pesos } from "@/lib/validation/punto-de-venta";
import styles from "./receta-form.module.css";

export type ConvenioAplicado = {
  rut: string;
  nombre: string;
  convenio: { nombre: string; tipo: string; porcentaje: number };
};

export function ConvenioCliente({
  aplicado,
  descuento,
  onChange,
  disabled,
}: {
  aplicado: ConvenioAplicado | null;
  descuento: number;
  onChange: (c: ConvenioAplicado | null) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const [rut, setRut] = useState("");
  const [estado, setEstado] = useState<{ error?: string; cargando?: boolean }>(
    {},
  );

  async function buscar() {
    setEstado({ cargando: true });
    try {
      const r = await fetch(
        `/api/privada/convenios/cliente?rut=${encodeURIComponent(rut)}`,
        { cache: "no-store" },
      );
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error ?? "No se pudo consultar.");
      onChange(data);
      setEstado({});
    } catch (e) {
      setEstado({ error: e instanceof Error ? e.message : "Error." });
    }
  }

  if (aplicado)
    return (
      <div className={styles.convenioAplicado} role="status">
        <BadgePercent aria-hidden size={20} />
        <div>
          <b>
            {aplicado.convenio.nombre} · {aplicado.convenio.porcentaje} %
          </b>
          <small>
            {aplicado.nombre} ({aplicado.rut}) · Descuento {pesos(descuento)}
          </small>
        </div>
        <button
          type="button"
          aria-label="Quitar convenio"
          disabled={disabled}
          onClick={() => {
            onChange(null);
            setRut("");
          }}
        >
          <X aria-hidden size={16} />
        </button>
      </div>
    );

  return (
    <div className={styles.convenio}>
      <label htmlFor={`${id}-rut`}>
        Convenio del cliente (Isapre, Fonasa, GES, seguro)
        <span>
          <input
            id={`${id}-rut`}
            value={rut}
            placeholder="RUT del cliente"
            disabled={disabled}
            onChange={(e) => {
              setRut(formatRut(e.target.value));
              setEstado({});
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (rut) void buscar();
              }
            }}
          />
          <button
            type="button"
            disabled={disabled || !rut || estado.cargando}
            onClick={buscar}
          >
            {estado.cargando ? "Buscando…" : "Aplicar"}
          </button>
        </span>
      </label>
      {estado.error && <p role="alert">{estado.error}</p>}
    </div>
  );
}

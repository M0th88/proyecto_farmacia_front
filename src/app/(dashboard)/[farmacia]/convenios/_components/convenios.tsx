"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Modal } from "@/components/ui/modal";
import type { ListadoConvenios } from "@/lib/private/convenios";
import { formatRut } from "@/lib/user-input";
import {
  afiliadoSchema,
  convenioSchema,
  etiquetaTipoConvenio,
  type TipoConvenio,
  tiposConvenio,
} from "@/lib/validation/convenios";
import styles from "./convenios.module.css";

type Convenio = ListadoConvenios["convenios"][number];
type Borrador = {
  id?: number;
  nombre: string;
  tipo: TipoConvenio;
  porcentaje: string;
  activo: boolean;
};
const vacio: Borrador = {
  nombre: "",
  tipo: "ISAPRE",
  porcentaje: "",
  activo: true,
};

async function enviar(url: string, method: string, body?: unknown) {
  const r = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error ?? "No se pudo completar la acción.");
  return data;
}

export function Convenios({ inicial }: { inicial: ListadoConvenios }) {
  const router = useRouter();
  const id = useId();
  const [editando, setEditando] = useState<Borrador | null>(null);
  const [afiliado, setAfiliado] = useState({
    rut: "",
    nombre: "",
    convenioId: 0,
  });
  const [busqueda, setBusqueda] = useState("");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const { convenios, clientes } = inicial;
  const activos = convenios.filter((c) => c.activo);
  const filtrados = clientes.filter((c) =>
    `${c.rut} ${c.nombre} ${c.convenio}`
      .toLowerCase()
      .includes(busqueda.toLowerCase()),
  );

  async function accion(fn: () => Promise<string>) {
    setOcupado(true);
    setError("");
    setAviso("");
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

  const abrir = (c?: Convenio) => {
    setError("");
    setEditando(
      c
        ? {
            id: c.id,
            nombre: c.nombre,
            tipo: (tiposConvenio as readonly string[]).includes(c.tipo)
              ? (c.tipo as TipoConvenio)
              : "SEGURO",
            porcentaje: String(c.porcentaje),
            activo: c.activo,
          }
        : vacio,
    );
  };

  return (
    <section className="pos-shell">
      <header className="pos-header">
        <div>
          <h1>Convenios</h1>
          <span>
            Descuentos automáticos por Isapre, Fonasa, GES o seguros. El POS los
            aplica al ingresar el RUT del cliente afiliado.
          </span>
        </div>
      </header>

      <div className="pos-metrics">
        <div>
          <small>Convenios activos</small>
          <strong>{activos.length}</strong>
        </div>
        <div>
          <small>Clientes afiliados</small>
          <strong>{clientes.length}</strong>
        </div>
        <div>
          <small>Mayor descuento</small>
          <strong>
            {activos.length
              ? `${Math.max(...activos.map((c) => c.porcentaje))} %`
              : "—"}
          </strong>
        </div>
        <div>
          <small>Inactivos</small>
          <strong>{convenios.length - activos.length}</strong>
        </div>
      </div>

      {aviso && (
        <p className={styles.ok} role="status">
          {aviso}
        </p>
      )}
      {error && !editando && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.columnas}>
        <section className="pos-panel">
          <div className="pos-title">
            <div>
              <small>CONVENIOS</small>
              <h2>Descuentos configurados</h2>
            </div>
            <button
              type="button"
              className={styles.primario}
              onClick={() => abrir()}
            >
              <Plus aria-hidden size={16} /> Nuevo convenio
            </button>
          </div>
          {convenios.length ? (
            <ul className={styles.lista}>
              {convenios.map((c) => (
                <li key={c.id} data-inactivo={!c.activo || undefined}>
                  <div>
                    <b>{c.nombre}</b>
                    <small>
                      {etiquetaTipoConvenio[c.tipo as TipoConvenio] ?? c.tipo} ·{" "}
                      {c.afiliados} afiliados
                      {!c.activo && " · Inactivo"}
                    </small>
                  </div>
                  <strong>{c.porcentaje} %</strong>
                  <button
                    type="button"
                    className={styles.icono}
                    aria-label={`Editar ${c.nombre}`}
                    onClick={() => abrir(c)}
                  >
                    <Pencil aria-hidden size={16} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="pos-empty">
              Aún no hay convenios. Crea el primero, por ejemplo «Isapre Colmena
              15 %».
            </p>
          )}
        </section>

        <section className="pos-panel">
          <div className="pos-title">
            <div>
              <small>AFILIADOS</small>
              <h2>Clientes con convenio</h2>
            </div>
          </div>
          <form
            className={styles.form}
            onSubmit={async (e) => {
              e.preventDefault();
              const parsed = afiliadoSchema.safeParse(afiliado);
              if (!parsed.success) {
                setError(
                  parsed.error.issues[0]?.message ?? "Revisa los datos.",
                );
                return;
              }
              if (
                await accion(async () => {
                  await enviar(
                    "/api/privada/convenios/afiliados",
                    "POST",
                    parsed.data,
                  );
                  return `${parsed.data.nombre} quedó afiliado.`;
                })
              )
                setAfiliado({ rut: "", nombre: "", convenioId: 0 });
            }}
          >
            <label htmlFor={`${id}-rut`}>
              RUT
              <input
                id={`${id}-rut`}
                value={afiliado.rut}
                placeholder="12.345.678-9"
                onChange={(e) =>
                  setAfiliado({ ...afiliado, rut: formatRut(e.target.value) })
                }
              />
            </label>
            <label htmlFor={`${id}-nombre`}>
              Nombre
              <input
                id={`${id}-nombre`}
                value={afiliado.nombre}
                maxLength={120}
                onChange={(e) =>
                  setAfiliado({ ...afiliado, nombre: e.target.value })
                }
              />
            </label>
            <label htmlFor={`${id}-conv`}>
              Convenio
              <select
                id={`${id}-conv`}
                value={afiliado.convenioId}
                onChange={(e) =>
                  setAfiliado({
                    ...afiliado,
                    convenioId: Number(e.target.value),
                  })
                }
              >
                <option value={0}>Selecciona…</option>
                {activos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} ({c.porcentaje} %)
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className={styles.primario}
              disabled={ocupado || !activos.length}
            >
              Afiliar
            </button>
          </form>
          <p className="pos-footnote">
            Si el RUT ya estaba afiliado, se cambia al convenio elegido.
          </p>
          <input
            className={styles.buscar}
            type="search"
            placeholder="Buscar por RUT, nombre o convenio"
            aria-label="Buscar afiliados"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          {filtrados.length ? (
            <ul className={styles.lista}>
              {filtrados.map((c) => (
                <li key={c.id} data-inactivo={!c.convenioActivo || undefined}>
                  <div>
                    <b>{c.nombre}</b>
                    <small>
                      {c.rut} · {c.convenio}
                      {!c.convenioActivo && " (inactivo)"}
                    </small>
                  </div>
                  <button
                    type="button"
                    className={styles.icono}
                    aria-label={`Quitar afiliación de ${c.nombre}`}
                    disabled={ocupado}
                    onClick={() => {
                      if (
                        !window.confirm(`¿Quitar el convenio de ${c.nombre}?`)
                      )
                        return;
                      void accion(async () => {
                        await enviar(
                          `/api/privada/convenios/afiliados?id=${c.id}`,
                          "DELETE",
                        );
                        return `Se quitó el convenio de ${c.nombre}.`;
                      });
                    }}
                  >
                    <Trash2 aria-hidden size={16} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="pos-empty">
              {busqueda
                ? "No hay afiliados que coincidan."
                : "Todavía no hay clientes afiliados."}
            </p>
          )}
        </section>
      </div>

      <Modal
        open={editando !== null}
        onOpenChange={(open) => !ocupado && !open && setEditando(null)}
        title={editando?.id ? "Editar convenio" : "Nuevo convenio"}
        description="El porcentaje se descuenta del subtotal con IVA."
      >
        {editando && (
          <form
            className={styles.modal}
            onSubmit={async (e) => {
              e.preventDefault();
              const parsed = convenioSchema.safeParse({
                ...editando,
                porcentaje: Number(editando.porcentaje.replace(",", ".")),
              });
              if (!parsed.success) {
                setError(
                  parsed.error.issues[0]?.message ?? "Revisa los datos.",
                );
                return;
              }
              if (
                await accion(async () => {
                  await enviar(
                    "/api/privada/convenios",
                    editando.id ? "PATCH" : "POST",
                    editando.id
                      ? { ...parsed.data, id: editando.id }
                      : parsed.data,
                  );
                  return `Convenio «${parsed.data.nombre}» guardado.`;
                })
              )
                setEditando(null);
            }}
          >
            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}
            <label htmlFor={`${id}-cnombre`}>
              Nombre
              <input
                id={`${id}-cnombre`}
                value={editando.nombre}
                maxLength={80}
                placeholder="Isapre Colmena"
                onChange={(e) =>
                  setEditando({ ...editando, nombre: e.target.value })
                }
              />
            </label>
            <label htmlFor={`${id}-ctipo`}>
              Tipo
              <select
                id={`${id}-ctipo`}
                value={editando.tipo}
                onChange={(e) =>
                  setEditando({
                    ...editando,
                    tipo: e.target.value as TipoConvenio,
                  })
                }
              >
                {tiposConvenio.map((t) => (
                  <option key={t} value={t}>
                    {etiquetaTipoConvenio[t]}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor={`${id}-cpct`}>
              Descuento (%)
              <input
                id={`${id}-cpct`}
                inputMode="decimal"
                value={editando.porcentaje}
                placeholder="15"
                onChange={(e) =>
                  setEditando({ ...editando, porcentaje: e.target.value })
                }
              />
            </label>
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={editando.activo}
                onChange={(e) =>
                  setEditando({ ...editando, activo: e.target.checked })
                }
              />
              Convenio activo
            </label>
            <button
              type="submit"
              className={styles.primario}
              disabled={ocupado}
            >
              Guardar
            </button>
          </form>
        )}
      </Modal>
    </section>
  );
}

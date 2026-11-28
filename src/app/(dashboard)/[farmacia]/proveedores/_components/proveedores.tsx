"use client";

import { Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import g from "@/components/gestion.module.css";
import { Modal } from "@/components/ui/modal";
import { enviar } from "@/lib/client-api";
import { formatRut } from "@/lib/user-input";
import { proveedorSchema } from "@/lib/validation/abastecimiento";

type Proveedor = {
  id: number;
  rut: string;
  razonSocial: string;
  nombreFantasia: string;
  contacto: string;
  telefono: string;
  email: string;
  direccion: string;
  activo: boolean;
  ordenes: number;
  rechazosPendientes: number;
};
type Borrador = Omit<Proveedor, "id" | "ordenes" | "rechazosPendientes"> & {
  id?: number;
};
const vacio: Borrador = {
  rut: "",
  razonSocial: "",
  nombreFantasia: "",
  contacto: "",
  telefono: "",
  email: "",
  direccion: "",
  activo: true,
};
const CAMPOS: { k: keyof Borrador; label: string; max: number }[] = [
  { k: "razonSocial", label: "Razón social", max: 120 },
  { k: "nombreFantasia", label: "Nombre de fantasía", max: 120 },
  { k: "contacto", label: "Contacto", max: 120 },
  { k: "telefono", label: "Teléfono", max: 30 },
  { k: "email", label: "Correo", max: 120 },
  { k: "direccion", label: "Dirección", max: 160 },
];

export function Proveedores({ proveedores }: { proveedores: Proveedor[] }) {
  const router = useRouter();
  const id = useId();
  const [form, setForm] = useState<Borrador | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const filtrados = proveedores.filter((p) =>
    `${p.rut} ${p.razonSocial} ${p.nombreFantasia} ${p.contacto}`
      .toLowerCase()
      .includes(busqueda.toLowerCase()),
  );

  async function guardar() {
    if (!form) return;
    const parsed = proveedorSchema.safeParse(form);
    if (!parsed.success)
      return setError(parsed.error.issues[0]?.message ?? "Revisa los datos.");
    setOcupado(true);
    setError("");
    try {
      await enviar(
        "/api/privada/proveedores",
        form.id ? "PATCH" : "POST",
        form.id ? { ...parsed.data, id: form.id } : parsed.data,
      );
      setAviso(`Proveedor «${parsed.data.razonSocial}» guardado.`);
      setForm(null);
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
          <h1>Proveedores</h1>
          <span>
            Directorio de droguerías y laboratorios que abastecen la farmacia.
            Se usan en compras, rechazos y devoluciones.
          </span>
        </div>
      </header>
      <div className="pos-metrics">
        <div>
          <small>Proveedores activos</small>
          <strong>{proveedores.filter((p) => p.activo).length}</strong>
        </div>
        <div>
          <small>Órdenes de compra</small>
          <strong>{proveedores.reduce((n, p) => n + p.ordenes, 0)}</strong>
        </div>
        <div>
          <small>Rechazos por devolver</small>
          <strong>
            {proveedores.reduce((n, p) => n + p.rechazosPendientes, 0)}
          </strong>
        </div>
        <div>
          <small>Inactivos</small>
          <strong>{proveedores.filter((p) => !p.activo).length}</strong>
        </div>
      </div>
      {aviso && (
        <p className={g.ok} role="status">
          {aviso}
        </p>
      )}
      <section className="pos-panel">
        <div className={g.barra}>
          <input
            className={g.buscar}
            type="search"
            placeholder="Buscar por RUT, nombre o contacto"
            aria-label="Buscar proveedores"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          <button
            type="button"
            className={g.primario}
            onClick={() => {
              setError("");
              setForm(vacio);
            }}
          >
            <Plus aria-hidden size={16} /> Nuevo proveedor
          </button>
        </div>
        {filtrados.length ? (
          <div className={g.scroll}>
            <table className={g.tabla}>
              <thead>
                <tr>
                  <th>Proveedor</th>
                  <th>Contacto</th>
                  <th className={g.num}>Órdenes</th>
                  <th>Estado</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {filtrados.map((p) => (
                  <tr key={p.id} data-inactivo={!p.activo || undefined}>
                    <td>
                      <b>{p.nombreFantasia || p.razonSocial}</b>
                      <small>
                        {p.rut}
                        {p.nombreFantasia ? ` · ${p.razonSocial}` : ""}
                      </small>
                    </td>
                    <td>
                      {p.contacto || "—"}
                      <small>
                        {[p.telefono, p.email].filter(Boolean).join(" · ")}
                      </small>
                    </td>
                    <td className={g.num}>{p.ordenes}</td>
                    <td>
                      <span
                        className={g.estado}
                        data-tono={p.activo ? "ok" : undefined}
                      >
                        {p.activo ? "Activo" : "Inactivo"}
                      </span>
                      {p.rechazosPendientes > 0 && (
                        <Link href="/privada/productos-rechazados">
                          <small>
                            {p.rechazosPendientes} rechazos pendientes
                          </small>
                        </Link>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className={g.boton}
                        aria-label={`Editar ${p.razonSocial}`}
                        onClick={() => {
                          setError("");
                          setForm(p);
                        }}
                      >
                        <Pencil aria-hidden size={14} /> Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="pos-empty">
            {busqueda
              ? "No hay proveedores que coincidan."
              : "Aún no hay proveedores. Crea el primero para emitir órdenes de compra."}
          </p>
        )}
      </section>

      <Modal
        open={form !== null}
        onOpenChange={(o) => !ocupado && !o && setForm(null)}
        title={form?.id ? "Editar proveedor" : "Nuevo proveedor"}
        description="El RUT identifica al proveedor en órdenes y devoluciones."
      >
        {form && (
          <form
            className={g.form}
            onSubmit={(e) => {
              e.preventDefault();
              void guardar();
            }}
          >
            {error && (
              <p className={g.error} role="alert">
                {error}
              </p>
            )}
            <div className={g.campos}>
              <label htmlFor={`${id}-rut`}>
                RUT
                <input
                  id={`${id}-rut`}
                  value={form.rut}
                  placeholder="76.123.456-7"
                  onChange={(e) =>
                    setForm({ ...form, rut: formatRut(e.target.value) })
                  }
                />
              </label>
              {CAMPOS.map((c) => (
                <label key={c.k} htmlFor={`${id}-${c.k}`}>
                  {c.label}
                  <input
                    id={`${id}-${c.k}`}
                    value={String(form[c.k] ?? "")}
                    maxLength={c.max}
                    type={c.k === "email" ? "email" : "text"}
                    onChange={(e) =>
                      setForm({ ...form, [c.k]: e.target.value })
                    }
                  />
                </label>
              ))}
            </div>
            <label className={g.check}>
              <input
                type="checkbox"
                checked={form.activo}
                onChange={(e) => setForm({ ...form, activo: e.target.checked })}
              />
              Proveedor activo
            </label>
            <button type="submit" className={g.primario} disabled={ocupado}>
              Guardar proveedor
            </button>
          </form>
        )}
      </Modal>
    </section>
  );
}

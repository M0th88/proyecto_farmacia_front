"use client";

import { Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";
import g from "@/components/gestion.module.css";
import { Modal } from "@/components/ui/modal";
import { enviar } from "@/lib/client-api";
import { marcaSchema } from "@/lib/validation/abastecimiento";

type Marca = {
  id: number;
  nombre: string;
  laboratorio: string;
  pais: string;
  activo: boolean;
  productos: number;
};
type Producto = {
  id: number;
  nombre: string;
  principioActivo: string;
  marcaId: number | null;
};
type Borrador = Omit<Marca, "id" | "productos"> & { id?: number };

export function Marcas({
  marcas,
  productos,
}: {
  marcas: Marca[];
  productos: Producto[];
}) {
  const router = useRouter();
  const id = useId();
  const [form, setForm] = useState<Borrador | null>(null);
  const [filtro, setFiltro] = useState<"todos" | "sin" | number>("sin");
  const [busqueda, setBusqueda] = useState("");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const nombreMarca = useMemo(
    () => new Map(marcas.map((m) => [m.id, m.nombre])),
    [marcas],
  );
  const lista = productos.filter(
    (p) =>
      (filtro === "todos" ||
        (filtro === "sin" ? p.marcaId === null : p.marcaId === filtro)) &&
      `${p.nombre} ${p.principioActivo}`
        .toLowerCase()
        .includes(busqueda.toLowerCase()),
  );

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

  return (
    <section className="pos-shell">
      <header className="pos-header">
        <div>
          <h1>Marcas</h1>
          <span>
            Laboratorios y marcas comerciales. Asigna la marca a cada producto
            para distinguir alternativas del mismo principio activo.
          </span>
        </div>
      </header>
      <div className="pos-metrics">
        <div>
          <small>Marcas activas</small>
          <strong>{marcas.filter((m) => m.activo).length}</strong>
        </div>
        <div>
          <small>Productos con marca</small>
          <strong>{productos.filter((p) => p.marcaId).length}</strong>
        </div>
        <div>
          <small>Sin marca</small>
          <strong>{productos.filter((p) => !p.marcaId).length}</strong>
        </div>
        <div>
          <small>Productos activos</small>
          <strong>{productos.length}</strong>
        </div>
      </div>
      {aviso && (
        <p className={g.ok} role="status">
          {aviso}
        </p>
      )}
      {error && !form && (
        <p className={g.error} role="alert">
          {error}
        </p>
      )}
      <div className="pos-grid">
        <section className="pos-panel">
          <div className="pos-title">
            <h2>Marcas</h2>
            <button
              type="button"
              className={g.primario}
              onClick={() => {
                setError("");
                setForm({
                  nombre: "",
                  laboratorio: "",
                  pais: "Chile",
                  activo: true,
                });
              }}
            >
              <Plus aria-hidden size={16} /> Nueva marca
            </button>
          </div>
          {marcas.length ? (
            <table className={g.tabla}>
              <thead>
                <tr>
                  <th>Marca</th>
                  <th className={g.num}>Productos</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {marcas.map((m) => (
                  <tr key={m.id} data-inactivo={!m.activo || undefined}>
                    <td>
                      <button
                        type="button"
                        className={g.boton}
                        aria-pressed={filtro === m.id}
                        title="Ver sus productos"
                        onClick={() => setFiltro(m.id)}
                      >
                        {m.nombre}
                      </button>
                      <small>
                        {[m.laboratorio, m.pais].filter(Boolean).join(" · ") ||
                          "Sin laboratorio"}
                      </small>
                    </td>
                    <td className={g.num}>{m.productos}</td>
                    <td>
                      <button
                        type="button"
                        className={g.boton}
                        aria-label={`Editar ${m.nombre}`}
                        onClick={() => {
                          setError("");
                          setForm(m);
                        }}
                      >
                        <Pencil aria-hidden size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="pos-empty">
              Aún no hay marcas. Crea la primera, por ejemplo «Laboratorio
              Chile».
            </p>
          )}
        </section>

        <section className="pos-panel">
          <div className="pos-title">
            <h2>Asignar marca a productos</h2>
          </div>
          <div className={g.barra}>
            <div className={g.segmento} role="group" aria-label="Filtro">
              <button
                type="button"
                aria-pressed={filtro === "sin"}
                onClick={() => setFiltro("sin")}
              >
                Sin marca
              </button>
              <button
                type="button"
                aria-pressed={filtro === "todos"}
                onClick={() => setFiltro("todos")}
              >
                Todos
              </button>
              {typeof filtro === "number" && (
                <button type="button" aria-pressed>
                  {nombreMarca.get(filtro)}
                </button>
              )}
            </div>
            <input
              className={g.buscar}
              type="search"
              placeholder="Producto o principio activo"
              aria-label="Buscar productos"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          {lista.length ? (
            <div className={g.scroll}>
              <table className={g.tabla}>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Marca</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.slice(0, 150).map((p) => (
                    <tr key={p.id}>
                      <td>
                        {p.nombre}
                        <small>{p.principioActivo}</small>
                      </td>
                      <td>
                        <select
                          className={g.celda}
                          aria-label={`Marca de ${p.nombre}`}
                          value={p.marcaId ?? ""}
                          disabled={ocupado}
                          onChange={(e) => {
                            const marcaId = e.target.value
                              ? Number(e.target.value)
                              : null;
                            void accion(async () => {
                              await enviar(
                                "/api/privada/marcas/asignar",
                                "POST",
                                {
                                  medicamentoId: p.id,
                                  marcaId,
                                },
                              );
                              return `${p.nombre}: ${marcaId ? nombreMarca.get(marcaId) : "sin marca"}.`;
                            });
                          }}
                        >
                          <option value="">Sin marca</option>
                          {marcas
                            .filter((m) => m.activo || m.id === p.marcaId)
                            .map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.nombre}
                              </option>
                            ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="pos-empty">No hay productos en este filtro.</p>
          )}
        </section>
      </div>

      <Modal
        open={form !== null}
        onOpenChange={(o) => !ocupado && !o && setForm(null)}
        title={form?.id ? "Editar marca" : "Nueva marca"}
        description="Una marca inactiva deja de ofrecerse al asignar productos."
      >
        {form && (
          <form
            className={g.form}
            onSubmit={async (e) => {
              e.preventDefault();
              const parsed = marcaSchema.safeParse(form);
              if (!parsed.success)
                return setError(
                  parsed.error.issues[0]?.message ?? "Revisa los datos.",
                );
              if (
                await accion(async () => {
                  await enviar(
                    "/api/privada/marcas",
                    form.id ? "PATCH" : "POST",
                    form.id ? { ...parsed.data, id: form.id } : parsed.data,
                  );
                  return `Marca «${parsed.data.nombre}» guardada.`;
                })
              )
                setForm(null);
            }}
          >
            {error && (
              <p className={g.error} role="alert">
                {error}
              </p>
            )}
            <label htmlFor={`${id}-n`}>
              Nombre
              <input
                id={`${id}-n`}
                value={form.nombre}
                maxLength={80}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              />
            </label>
            <div className={g.campos}>
              <label htmlFor={`${id}-l`}>
                Laboratorio
                <input
                  id={`${id}-l`}
                  value={form.laboratorio}
                  maxLength={120}
                  onChange={(e) =>
                    setForm({ ...form, laboratorio: e.target.value })
                  }
                />
              </label>
              <label htmlFor={`${id}-p`}>
                País
                <input
                  id={`${id}-p`}
                  value={form.pais}
                  maxLength={60}
                  onChange={(e) => setForm({ ...form, pais: e.target.value })}
                />
              </label>
            </div>
            <label className={g.check}>
              <input
                type="checkbox"
                checked={form.activo}
                onChange={(e) => setForm({ ...form, activo: e.target.checked })}
              />
              Marca activa
            </label>
            <button type="submit" className={g.primario} disabled={ocupado}>
              Guardar marca
            </button>
          </form>
        )}
      </Modal>
    </section>
  );
}

"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Barcode, Plus, Printer, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useDebounce } from "@/hooks/use-debounce";
import type { ProductLabel } from "@/lib/types/productos";
import {
  generateProductBarcode,
  getProductLabel,
  listProducts,
  productsQueryKey,
} from "../../actions";
import { codificarEtiqueta } from "./codigo-etiqueta";
import styles from "./etiquetas-productos.module.css";

type Fila = {
  id: number;
  producto: ProductLabel;
  loteId: number;
  ubicacionId: number;
  cantidad: string;
  temperatura: string;
  fotosensible: string;
  orientacion: "horizontal" | "vertical";
};

function filaNueva(producto: ProductLabel, id: number): Fila {
  return {
    id,
    producto,
    loteId: 0,
    ubicacionId: 0,
    cantidad: "1",
    temperatura: "",
    fotosensible: "",
    orientacion: "horizontal",
  };
}

const fecha = (iso: string) => iso.split("-").reverse().join("/");

export function EtiquetasProductos({
  currentUserId,
  inicial,
  productoNoDisponible,
}: {
  currentUserId: number;
  inicial: ProductLabel | null;
  productoNoDisponible: boolean;
}) {
  const [filas, setFilas] = useState<Fila[]>(() =>
    inicial ? [filaNueva(inicial, 0)] : [],
  );
  const siguienteId = useRef(1);
  const [busqueda, setBusqueda] = useState("");
  const [seleccionado, setSeleccionado] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(
    productoNoDisponible
      ? "El producto seleccionado ya no está disponible."
      : "",
  );
  const cliente = useQueryClient();
  const filtro = useDebounce(busqueda.trim());
  const catalogo = useQuery({
    queryKey: [...productsQueryKey, "etiquetas", currentUserId, filtro],
    queryFn: ({ signal }) =>
      listProducts({ pageParam: 0, search: filtro, sorting: [], signal }),
  });
  const etiquetas = useMemo(
    () =>
      filas.map((fila) => {
        const lote = fila.producto.lotes.find(({ id }) => id === fila.loteId);
        const codigo = fila.producto.codigoBarra
          ? codificarEtiqueta(fila.producto.codigoBarra)
          : null;
        const cabe =
          codigo &&
          codigo.ancho <= (fila.orientacion === "vertical" ? 192 : 272);
        return {
          fila,
          lote,
          ubicacion: lote?.ubicaciones.find(
            ({ id }) => id === fila.ubicacionId,
          ),
          codigo: cabe ? codigo : null,
          fueraDeAncho: codigo && !cabe,
          cantidad: Number(fila.cantidad),
        };
      }),
    [filas],
  );
  const total = etiquetas.reduce((sum, { cantidad }) => sum + cantidad, 0);
  const todasValidas =
    etiquetas.length > 0 &&
    etiquetas.every(
      ({ codigo, cantidad }) =>
        codigo &&
        Number.isInteger(cantidad) &&
        cantidad >= 1 &&
        cantidad <= 100,
    );
  const listoParaImprimir = todasValidas && total <= 200;

  function actualizar(
    id: number,
    cambio: Partial<Omit<Fila, "id" | "producto">>,
  ) {
    setFilas((actuales) =>
      actuales.map((fila) => (fila.id === id ? { ...fila, ...cambio } : fila)),
    );
  }

  async function agregar() {
    if (!seleccionado || ocupado || busqueda.trim() !== filtro) return;
    setOcupado(true);
    setError("");
    try {
      const producto = await getProductLabel(Number(seleccionado));
      const nueva = filaNueva(producto, siguienteId.current++);
      setFilas((actuales) => [...actuales, nueva]);
      setSeleccionado("");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "No se pudo cargar el producto.",
      );
    } finally {
      setOcupado(false);
    }
  }

  async function generar(id: number) {
    if (ocupado) return;
    setOcupado(true);
    setError("");
    try {
      const producto = await generateProductBarcode(id);
      setFilas((actuales) =>
        actuales.map((fila) =>
          fila.producto.id === id ? { ...fila, producto } : fila,
        ),
      );
      void cliente.invalidateQueries({ queryKey: productsQueryKey });
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "No se pudo generar el código.",
      );
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      <section className={styles.panel} aria-labelledby="etiquetas-seleccion">
        <h2 id="etiquetas-seleccion">Seleccionar productos</h2>
        <form
          className={styles.buscador}
          onSubmit={(event) => {
            event.preventDefault();
            void agregar();
          }}
        >
          <label>
            Buscar producto
            <input
              type="search"
              value={busqueda}
              maxLength={200}
              placeholder="Nombre o código"
              onChange={(event) => {
                setBusqueda(event.target.value);
                setSeleccionado("");
              }}
            />
          </label>
          <label>
            Resultados
            <select
              value={seleccionado}
              onChange={(event) => setSeleccionado(event.target.value)}
              disabled={
                catalogo.isPending ||
                catalogo.isError ||
                busqueda.trim() !== filtro
              }
            >
              <option value="">
                {catalogo.isPending || busqueda.trim() !== filtro
                  ? "Buscando…"
                  : "Elige un producto"}
              </option>
              {catalogo.data?.data.map((producto) => (
                <option value={producto.id} key={producto.id}>
                  {producto.nombre} · {producto.codigoBarra ?? "Sin código"}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="submit"
            disabled={ocupado || !seleccionado || busqueda.trim() !== filtro}
          >
            <Plus size={17} aria-hidden="true" /> Añadir
          </Button>
        </form>
        {catalogo.isError ? (
          <div role="alert">
            <p>No se pudo cargar el catálogo.</p>
            <Button variant="outline" onClick={() => void catalogo.refetch()}>
              Reintentar
            </Button>
          </div>
        ) : catalogo.data?.data.length === 0 ? (
          <p role="status">No hay productos que coincidan.</p>
        ) : catalogo.data?.nextPage != null ? (
          <p className={styles.nota}>
            Acota la búsqueda para encontrar más productos.
          </p>
        ) : null}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </section>

      <section
        className={styles.panel}
        aria-labelledby="etiquetas-configuracion"
      >
        <div className={styles.barra}>
          <h2 id="etiquetas-configuracion">Configurar etiquetas</h2>
          <Button
            disabled={ocupado || !listoParaImprimir}
            onClick={() => window.print()}
          >
            <Printer size={17} aria-hidden="true" />
            {listoParaImprimir ? `Imprimir (${total})` : "Imprimir etiquetas"}
          </Button>
        </div>
        {filas.length === 0 && (
          <p>Añade un producto para preparar su etiqueta.</p>
        )}
        {total > 200 && (
          <p className={styles.error} role="alert">
            Imprime hasta 200 etiquetas por tanda.
          </p>
        )}
        {etiquetas.map(({ fila, lote, codigo, fueraDeAncho, cantidad }) => (
          <section key={fila.id} className={styles.fila}>
            <header className={styles.barra}>
              <h3>{fila.producto.nombre}</h3>
              <Button
                variant="ghost"
                aria-label={`Quitar ${fila.producto.nombre}`}
                disabled={ocupado}
                onClick={() =>
                  setFilas((actuales) =>
                    actuales.filter(({ id }) => id !== fila.id),
                  )
                }
              >
                <Trash2 size={17} aria-hidden="true" />
              </Button>
            </header>
            <div className={styles.estado}>
              {fila.producto.codigoBarra ? (
                <span>
                  Código de barras <strong>{fila.producto.codigoBarra}</strong>
                </span>
              ) : (
                <Button
                  disabled={ocupado}
                  variant="outline"
                  onClick={() => void generar(fila.producto.id)}
                >
                  <Barcode size={17} aria-hidden="true" /> Generar y guardar
                  código
                </Button>
              )}
              {fila.producto.codigoBarra && !codigo && (
                <p className={styles.error}>
                  {fueraDeAncho
                    ? "El código es demasiado ancho para esta orientación."
                    : "El código guardado contiene caracteres incompatibles con la etiqueta."}
                </p>
              )}
            </div>
            <div className={styles.campos}>
              <label>
                Lote
                <select
                  value={fila.loteId}
                  onChange={(event) => {
                    const id = Number(event.target.value);
                    const nuevoLote = fila.producto.lotes.find(
                      (item) => item.id === id,
                    );
                    const ubicaciones = nuevoLote?.ubicaciones ?? [];
                    actualizar(fila.id, {
                      loteId: id,
                      ubicacionId:
                        ubicaciones.length === 1 ? ubicaciones[0].id : 0,
                    });
                  }}
                >
                  <option value="0">
                    {fila.producto.lotes.length
                      ? "Sin indicar lote"
                      : "Sin lotes registrados"}
                  </option>
                  {fila.producto.lotes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.numero}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Vencimiento
                <input
                  readOnly
                  value={lote ? fecha(lote.vencimiento) : ""}
                  placeholder="Según el lote"
                />
              </label>
              <label>
                Ubicación
                <select
                  value={fila.ubicacionId}
                  disabled={!lote?.ubicaciones.length}
                  onChange={(event) =>
                    actualizar(fila.id, {
                      ubicacionId: Number(event.target.value),
                    })
                  }
                >
                  <option value="0">Sin indicar ubicación</option>
                  {lote?.ubicaciones.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Cantidad de etiquetas
                <input
                  type="number"
                  min="1"
                  max="100"
                  step="1"
                  value={fila.cantidad}
                  aria-invalid={
                    !Number.isInteger(cantidad) ||
                    cantidad < 1 ||
                    cantidad > 100
                  }
                  onChange={(event) =>
                    actualizar(fila.id, { cantidad: event.target.value })
                  }
                />
                {(!Number.isInteger(cantidad) ||
                  cantidad < 1 ||
                  cantidad > 100) && (
                  <span className={styles.error}>
                    Ingresa una cantidad entre 1 y 100.
                  </span>
                )}
              </label>
              <label>
                Temperatura (opcional)
                <input
                  maxLength={40}
                  value={fila.temperatura}
                  placeholder="Según el envase"
                  onChange={(event) =>
                    actualizar(fila.id, { temperatura: event.target.value })
                  }
                />
              </label>
              <label>
                Fotosensible (opcional)
                <select
                  value={fila.fotosensible}
                  onChange={(event) =>
                    actualizar(fila.id, { fotosensible: event.target.value })
                  }
                >
                  <option value="">Sin indicar</option>
                  <option value="Sí">Sí</option>
                  <option value="No">No</option>
                </select>
              </label>
              <fieldset className={styles.orientacion}>
                <legend>Orientación</legend>
                <div>
                  {(["horizontal", "vertical"] as const).map((orientacion) => (
                    <label key={orientacion}>
                      <input
                        type="radio"
                        name={`orientacion-${fila.id}`}
                        value={orientacion}
                        checked={fila.orientacion === orientacion}
                        onChange={() => actualizar(fila.id, { orientacion })}
                      />
                      {orientacion === "horizontal" ? "Horizontal" : "Vertical"}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          </section>
        ))}
      </section>

      {etiquetas.some(({ codigo }) => codigo) && (
        <section className={styles.panel} aria-labelledby="etiquetas-vista">
          <h2 id="etiquetas-vista">Vista previa</h2>
          <p className={styles.nota}>
            Se muestra una etiqueta por fila. La impresión incluye las copias
            indicadas.
          </p>
          <div id="etiquetas-productos" className={styles.hoja}>
            {etiquetas.map(({ fila, lote, ubicacion, codigo, cantidad }) => {
              if (!codigo) return null;
              return Array.from(
                { length: listoParaImprimir ? cantidad : 1 },
                (_, copia) => (
                  <article
                    key={`${fila.id}-${copia}`}
                    className={`${styles.etiqueta} ${styles[fila.orientacion]}`}
                    data-copia={copia > 0 || undefined}
                  >
                    <strong className={styles.nombre}>
                      {fila.producto.nombre}
                    </strong>
                    {lote && (
                      <div className={styles.datos}>
                        <span>
                          Lote <b>{lote.numero}</b>
                        </span>
                        <span>
                          Vencimiento <b>{fecha(lote.vencimiento)}</b>
                        </span>
                      </div>
                    )}
                    {ubicacion && (
                      <div>
                        Ubicación <b>{ubicacion.nombre}</b>
                      </div>
                    )}
                    {(fila.temperatura.trim() || fila.fotosensible) && (
                      <div className={styles.datos}>
                        {fila.temperatura.trim() && (
                          <span>
                            Temperatura <b>{fila.temperatura.trim()}</b>
                          </span>
                        )}
                        {fila.fotosensible && (
                          <span>
                            Fotosensible <b>{fila.fotosensible}</b>
                          </span>
                        )}
                      </div>
                    )}
                    <div className={styles.codigo}>
                      <svg
                        viewBox={`0 0 ${codigo.ancho} 40`}
                        preserveAspectRatio="none"
                        aria-hidden="true"
                      >
                        <path fill="black" d={codigo.trazado} />
                      </svg>
                      <span>{fila.producto.codigoBarra}</span>
                    </div>
                  </article>
                ),
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}

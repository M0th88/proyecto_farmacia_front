"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { flushSync } from "react-dom";
import { etiquetaVencimiento } from "@/lib/etiqueta-vencimiento";
import type {
  CasoCuarentena,
  ExistenciaCuarentena,
  VistaInventario,
} from "@/lib/types/cuarentena";
import styles from "./admin-table.module.css";
import { EtiquetaExistencia } from "./etiqueta-existencia";
import etiquetaStyles from "./etiqueta-inventario.module.css";
import { usePharmacy } from "./pharmacy-provider";
import { LoadingLines } from "./section-loading";
import { Button } from "./ui/button";

const nombres = {
  SANITARIA: "Cuarentena sanitaria",
  TRANSITORIA: "Cuarentena transitoria",
  VENCIDOS: "Productos vencidos",
};

type Datos = {
  existencias: ExistenciaCuarentena[];
  casos: CasoCuarentena[];
  puedeResolver: boolean;
};

type Cambio =
  | {
      accion: "RESOLVER";
      casoId: number;
      resolucion: "LIBERADO" | "RECHAZADO";
      motivo: string;
    }
  | {
      accion: "RETIRAR_VENCIDO";
      stockId: number;
      cantidad: number;
      motivo: string;
    };

export function InventarioCuarentena({
  vista,
}: {
  vista: Exclude<VistaInventario, "SEGREGAR">;
}) {
  const farmacia = usePharmacy();
  const ruta = `/api/${farmacia}/cuarentena`;
  const cache = useQueryClient();
  const [filtro, setFiltro] = useState("");
  const [historial, setHistorial] = useState(false);
  const [impresion, setImpresion] = useState<{
    stock: ExistenciaCuarentena;
    caso?: CasoCuarentena;
  } | null>(null);
  const datos = useQuery<Datos>({
    queryKey: ["cuarentena", farmacia, vista],
    queryFn: async ({ signal }) => {
      const respuesta = await fetch(`${ruta}?vista=${vista}`, { signal });
      if (!respuesta.ok) throw new Error("No se pudo cargar el inventario.");
      return respuesta.json();
    },
  });
  const cambio = useMutation({
    mutationFn: async (payload: Cambio) => {
      const respuesta = await fetch(ruta, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!respuesta.ok) {
        const body = await respuesta.json().catch(() => null);
        throw new Error(body?.error ?? "No se pudo guardar el cambio.");
      }
    },
    onSuccess: () => cache.invalidateQueries(),
  });
  const casos = vista === "SANITARIA" || vista === "TRANSITORIA";
  const coincide = (stock: ExistenciaCuarentena) =>
    [stock.producto, stock.lote, stock.ubicacion].some((valor) =>
      valor
        .toLocaleLowerCase("es-CL")
        .includes(filtro.trim().toLocaleLowerCase("es-CL")),
    );
  const filas = casos
    ? datos.data?.casos
        .filter(
          (caso) =>
            (historial || !caso.resueltoEn) && coincide(caso.existencia),
        )
        .map((caso) => ({ stock: caso.existencia, caso }))
    : datos.data?.existencias
        .filter((stock) => {
          const { color } = etiquetaVencimiento(stock.vencimiento);
          return coincide(stock) && color === "rojo";
        })
        .map((stock) => ({ stock, caso: undefined }));
  const estadoImpresion = impresion?.caso
    ? { color: "gris", texto: `${nombres[vista]} · No dispensar` }
    : etiquetaVencimiento(impresion?.stock.vencimiento);

  function imprimir(stock: ExistenciaCuarentena, caso?: CasoCuarentena) {
    flushSync(() => setImpresion({ stock, caso }));
    window.print();
    setImpresion(null);
  }

  return (
    <section className="pos-shell">
      <header className="pos-header">
        <div>
          <h1>{nombres[vista]}</h1>
          <nav aria-label="Inventario y cuarentena">
            <Link href={`/${farmacia}/stocks-y-lotes`}>Stocks y Lotes</Link>
            {" · "}
            <Link href={`/${farmacia}/segregar-productos`}>
              Segregar productos
            </Link>
            {" · "}
            <Link href={`/${farmacia}/cuarentena-transitoria`}>
              Transitoria
            </Link>
            {" · "}
            <Link href={`/${farmacia}/cuarentena-sanitaria`}>Sanitaria</Link>
            {" · "}
            <Link href={`/${farmacia}/productos-vencidos`}>Vencidos</Link>
          </nav>
        </div>
      </header>
      <section className={styles.card}>
        <label>
          Buscar producto, lote o ubicación{" "}
          <input
            type="search"
            value={filtro}
            onChange={(event) => setFiltro(event.target.value)}
          />
        </label>{" "}
        {casos && (
          <label>
            <input
              type="checkbox"
              checked={historial}
              onChange={(event) => setHistorial(event.target.checked)}
            />{" "}
            Incluir casos resueltos
          </label>
        )}
        {cambio.error && <p role="alert">{cambio.error.message}</p>}
        {cambio.isSuccess && <p role="status">Cambio guardado.</p>}
        {datos.isPending && <LoadingLines />}
        {datos.isError && (
          <p role="alert">
            {datos.error.message}{" "}
            <Button
              type="button"
              variant="outline"
              onClick={() => datos.refetch()}
            >
              Reintentar
            </Button>
          </p>
        )}
        {filas?.length === 0 && <p>No hay registros para esta vista.</p>}
        {!!filas?.length && (
          <div className={etiquetaStyles.tabla}>
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Lote y ubicación</th>
                  <th>Vencimiento</th>
                  <th>{casos ? "Caso" : "Existencias"}</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filas.map(({ stock, caso }) => {
                  const estado = etiquetaVencimiento(stock.vencimiento);
                  const saldo = stock.cantidad - stock.cantidadBloqueada;
                  return (
                    <tr key={caso?.id ?? stock.id}>
                      <td>{stock.producto}</td>
                      <td>
                        {stock.lote}
                        <br />
                        {stock.ubicacion}
                      </td>
                      <td>
                        <span
                          className={etiquetaStyles.estado}
                          data-color={estado.color}
                        >
                          {estado.texto}
                        </span>
                        {stock.rotulo || stock.vencimiento}
                        {stock.vencimientoPorVerificar && (
                          <div>
                            <small>Fecha por verificar</small>
                          </div>
                        )}
                      </td>
                      <td>
                        {caso ? (
                          <>
                            <strong>
                              #{caso.id} · {caso.cantidad} unidades ·{" "}
                              {caso.resolucion ?? "Abierto"}
                            </strong>
                            <div>{caso.motivo}</div>
                            <small>
                              {new Date(caso.creadoEn).toLocaleString("es-CL", {
                                timeZone: "America/Santiago",
                              })}{" "}
                              · Usuario #{caso.registradoPor}
                            </small>
                            {caso.motivoResolucion && (
                              <div>
                                {caso.motivoResolucion} · Usuario #
                                {caso.resueltoPor}
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            {stock.cantidad} físicas · {stock.cantidadBloqueada}{" "}
                            en cuarentena
                          </>
                        )}
                      </td>
                      <td>
                        {!caso?.resueltoEn && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => imprimir(stock, caso)}
                          >
                            Imprimir etiqueta
                          </Button>
                        )}
                        {!caso &&
                          saldo > 0 &&
                          estado.color === "rojo" &&
                          !stock.vencimientoPorVerificar && (
                            <details>
                              <summary>Registrar retiro físico</summary>
                              <form
                                onSubmit={(event) => {
                                  event.preventDefault();
                                  const form = new FormData(
                                    event.currentTarget,
                                  );
                                  cambio.mutate({
                                    accion: "RETIRAR_VENCIDO",
                                    stockId: stock.id,
                                    cantidad: Number(form.get("cantidad")),
                                    motivo: String(form.get("motivo")),
                                  });
                                }}
                              >
                                <label>
                                  Unidades retiradas{" "}
                                  <input
                                    name="cantidad"
                                    type="number"
                                    min={1}
                                    max={saldo}
                                    defaultValue={saldo}
                                    required
                                  />
                                </label>
                                <label>
                                  Motivo{" "}
                                  <input
                                    name="motivo"
                                    minLength={3}
                                    maxLength={500}
                                    required
                                  />
                                </label>
                                <Button
                                  type="submit"
                                  disabled={cambio.isPending}
                                >
                                  Confirmar retiro
                                </Button>
                              </form>
                            </details>
                          )}
                        {caso &&
                          !caso.resueltoEn &&
                          datos.data?.puedeResolver && (
                            <details>
                              <summary>Resolver caso</summary>
                              <form
                                onSubmit={(event) => {
                                  event.preventDefault();
                                  const form = new FormData(
                                    event.currentTarget,
                                  );
                                  cambio.mutate({
                                    accion: "RESOLVER",
                                    casoId: caso.id,
                                    resolucion:
                                      form.get("resolucion") === "LIBERADO"
                                        ? "LIBERADO"
                                        : "RECHAZADO",
                                    motivo: String(form.get("motivo")),
                                  });
                                }}
                              >
                                <label>
                                  Resolución{" "}
                                  <select name="resolucion">
                                    {estado.color !== "rojo" &&
                                      estado.color !== "gris" &&
                                      !stock.vencimientoPorVerificar && (
                                        <option value="LIBERADO">
                                          Liberar de cuarentena
                                        </option>
                                      )}
                                    <option value="RECHAZADO">
                                      Confirmar retiro físico
                                    </option>
                                  </select>
                                </label>
                                <label>
                                  Motivo{" "}
                                  <input
                                    name="motivo"
                                    minLength={3}
                                    maxLength={500}
                                    required
                                  />
                                </label>
                                <Button
                                  type="submit"
                                  disabled={cambio.isPending}
                                >
                                  Confirmar resolución
                                </Button>
                              </form>
                            </details>
                          )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {impresion && (
        <EtiquetaExistencia
          stock={impresion.stock}
          estado={estadoImpresion}
          caso={impresion.caso}
        />
      )}
    </section>
  );
}

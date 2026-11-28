"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  PackageX,
  Printer,
  ShieldCheck,
  ShieldQuestion,
} from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";
import { flushSync } from "react-dom";
import { etiquetaVencimiento } from "@/lib/etiqueta-vencimiento";
import type {
  CasoCuarentena,
  ExistenciaCuarentena,
  VistaInventario,
} from "@/lib/types/cuarentena";
import { CuarentenaNav } from "./cuarentena-nav";
import { EtiquetaExistencia } from "./etiqueta-existencia";
import g from "./gestion.module.css";
import styles from "./inventario-cuarentena.module.css";
import { usePharmacy } from "./pharmacy-provider";
import { LoadingLines } from "./section-loading";
import { Modal } from "./ui/modal";

type Vista = Exclude<VistaInventario, "SEGREGAR">;

const TEXTOS: Record<
  Vista,
  { titulo: string; descripcion: string; vacio: string }
> = {
  TRANSITORIA: {
    titulo: "Cuarentena transitoria",
    descripcion:
      "Unidades retenidas mientras se verifica algo puntual: rotulación, embalaje o una duda de recepción. Se liberan o se retiran.",
    vacio:
      "No hay unidades en cuarentena transitoria. Se envían desde Segregar productos al detectar una duda en una existencia.",
  },
  SANITARIA: {
    titulo: "Cuarentena sanitaria",
    descripcion:
      "Unidades bloqueadas por un riesgo sanitario: daño, contaminación o sospecha de calidad. Solo se liberan con una resolución fundada.",
    vacio:
      "No hay unidades en cuarentena sanitaria. Se envían desde Segregar productos cuando una existencia presenta un riesgo.",
  },
  VENCIDOS: {
    titulo: "Productos vencidos",
    descripcion:
      "Existencias con fecha de vencimiento cumplida. No se pueden dispensar: registra su retiro físico y luego devuélvelas o destrúyelas.",
    vacio: "No hay existencias vencidas en este momento.",
  },
};

// Colores de etiquetaVencimiento → tonos de pastilla de la tabla.
const TONO_VENCIMIENTO: Record<string, string | undefined> = {
  verde: "ok",
  amarillo: "alerta",
  rojo: "peligro",
  gris: undefined,
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

type Accion =
  | { tipo: "RETIRAR"; stock: ExistenciaCuarentena }
  | { tipo: "RESOLVER"; stock: ExistenciaCuarentena; caso: CasoCuarentena };

const fechaHora = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Santiago",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const formatear = (iso: string) => {
  const p = Object.fromEntries(
    fechaHora.formatToParts(new Date(iso)).map((x) => [x.type, x.value]),
  );
  return `${p.day}-${p.month}-${p.year} ${p.hour}:${p.minute}`;
};

export function InventarioCuarentena({ vista }: { vista: Vista }) {
  const farmacia = usePharmacy();
  const id = useId();
  const ruta = `/api/${farmacia}/cuarentena`;
  const cache = useQueryClient();
  const [filtro, setFiltro] = useState("");
  const [historial, setHistorial] = useState(false);
  const [accion, setAccion] = useState<Accion | null>(null);
  const [aviso, setAviso] = useState("");
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
    onSuccess: (_, payload) => {
      setAviso(
        payload.accion === "RETIRAR_VENCIDO"
          ? `Retiro físico de ${payload.cantidad} unidades registrado.`
          : payload.resolucion === "LIBERADO"
            ? "Unidades liberadas: vuelven a estar disponibles."
            : "Retiro físico confirmado.",
      );
      setAccion(null);
      return cache.invalidateQueries();
    },
  });
  const texto = TEXTOS[vista];
  const casos = vista === "SANITARIA" || vista === "TRANSITORIA";
  const coincide = (stock: ExistenciaCuarentena) =>
    [stock.producto, stock.lote, stock.ubicacion].some((valor) =>
      valor
        .toLocaleLowerCase("es-CL")
        .includes(filtro.trim().toLocaleLowerCase("es-CL")),
    );
  const todosLosCasos = datos.data?.casos ?? [];
  const vencidas = (datos.data?.existencias ?? []).filter(
    (stock) => etiquetaVencimiento(stock.vencimiento).color === "rojo",
  );
  const filas = casos
    ? todosLosCasos
        .filter(
          (caso) =>
            (historial || !caso.resueltoEn) && coincide(caso.existencia),
        )
        .map((caso) => ({ stock: caso.existencia, caso }))
    : vencidas.filter(coincide).map((stock) => ({ stock, caso: undefined }));
  const abiertos = todosLosCasos.filter((c) => !c.resueltoEn);
  const estadoImpresion = impresion?.caso
    ? { color: "gris", texto: `${texto.titulo} · No dispensar` }
    : etiquetaVencimiento(impresion?.stock.vencimiento);

  function imprimir(stock: ExistenciaCuarentena, caso?: CasoCuarentena) {
    flushSync(() => setImpresion({ stock, caso }));
    window.print();
    setImpresion(null);
  }

  const metricas = casos
    ? [
        { label: "Casos abiertos", valor: abiertos.length },
        {
          label: "Unidades retenidas",
          valor: abiertos.reduce((t, c) => t + c.cantidad, 0),
        },
        {
          label: "Liberadas",
          valor: todosLosCasos.filter((c) => c.resolucion === "LIBERADO")
            .length,
        },
        {
          label: "Retiradas",
          valor: todosLosCasos.filter((c) => c.resolucion === "RECHAZADO")
            .length,
        },
      ]
    : [
        { label: "Existencias vencidas", valor: vencidas.length },
        {
          label: "Unidades por retirar",
          valor: vencidas.reduce(
            (t, s) => t + s.cantidad - s.cantidadBloqueada,
            0,
          ),
        },
        {
          label: "Ya bloqueadas",
          valor: vencidas.reduce((t, s) => t + s.cantidadBloqueada, 0),
        },
        {
          label: "Fecha por verificar",
          valor: vencidas.filter((s) => s.vencimientoPorVerificar).length,
        },
      ];

  return (
    <section className="pos-shell">
      <header className="pos-header">
        <div>
          <h1>{texto.titulo}</h1>
          <span>{texto.descripcion}</span>
          <CuarentenaNav farmacia={farmacia} actual={vista} />
        </div>
      </header>

      <div className="pos-metrics">
        {metricas.map((m) => (
          <div key={m.label}>
            <small>{m.label}</small>
            <strong>{datos.isPending ? "—" : m.valor}</strong>
          </div>
        ))}
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
            placeholder="Buscar producto, lote o ubicación"
            aria-label="Buscar producto, lote o ubicación"
            value={filtro}
            onChange={(event) => setFiltro(event.target.value)}
          />
          {casos && (
            <div className={g.segmento} role="group" aria-label="Casos">
              <button
                type="button"
                aria-pressed={!historial}
                onClick={() => setHistorial(false)}
              >
                Abiertos
              </button>
              <button
                type="button"
                aria-pressed={historial}
                onClick={() => setHistorial(true)}
              >
                Incluir resueltos
              </button>
            </div>
          )}
        </div>

        {datos.isPending && <LoadingLines />}
        {datos.isError && (
          <p className={g.error} role="alert">
            {datos.error.message}{" "}
            <button
              type="button"
              className={g.boton}
              onClick={() => datos.refetch()}
            >
              Reintentar
            </button>
          </p>
        )}

        {filas.length === 0 && datos.isSuccess && (
          <div className={styles.vacio}>
            <ShieldCheck aria-hidden size={34} />
            <p>
              {filtro
                ? "No hay registros que coincidan con la búsqueda."
                : texto.vacio}
            </p>
            {casos && !filtro && (
              <Link
                className={g.boton}
                href={`/${farmacia}/segregar-productos`}
              >
                Ir a Segregar productos
              </Link>
            )}
          </div>
        )}

        {filas.length > 0 && (
          <div className={g.scroll}>
            <table className={g.tabla}>
              <thead>
                <tr>
                  <th>Producto · lote</th>
                  <th>Vencimiento</th>
                  <th>{casos ? "Caso" : "Existencias"}</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {filas.map(({ stock, caso }) => {
                  const estado = etiquetaVencimiento(stock.vencimiento);
                  const saldo = stock.cantidad - stock.cantidadBloqueada;
                  const puedeRetirar =
                    !caso &&
                    saldo > 0 &&
                    estado.color === "rojo" &&
                    !stock.vencimientoPorVerificar;
                  const puedeResolver =
                    caso && !caso.resueltoEn && datos.data?.puedeResolver;
                  return (
                    <tr
                      key={caso?.id ?? stock.id}
                      data-inactivo={caso?.resueltoEn ? true : undefined}
                    >
                      <td>
                        <b>{stock.producto}</b>
                        <small>
                          Lote {stock.lote} · {stock.ubicacion}
                        </small>
                      </td>
                      <td>
                        <span
                          className={g.estado}
                          data-tono={TONO_VENCIMIENTO[estado.color]}
                        >
                          {estado.texto}
                        </span>
                        <small>{stock.rotulo || stock.vencimiento}</small>
                        {stock.vencimientoPorVerificar && (
                          <small className={styles.verificar}>
                            <ShieldQuestion aria-hidden size={12} /> Fecha por
                            verificar
                          </small>
                        )}
                      </td>
                      <td>
                        {caso ? (
                          <div className={styles.caso}>
                            <div>
                              <b>
                                #{caso.id} · {caso.cantidad} unidades
                              </b>{" "}
                              <span
                                className={g.estado}
                                data-tono={
                                  !caso.resolucion
                                    ? "alerta"
                                    : caso.resolucion === "LIBERADO"
                                      ? "ok"
                                      : "peligro"
                                }
                              >
                                {!caso.resolucion
                                  ? "Abierto"
                                  : caso.resolucion === "LIBERADO"
                                    ? "Liberado"
                                    : "Retirado"}
                              </span>
                            </div>
                            <span>{caso.motivo}</span>
                            <small>
                              {formatear(caso.creadoEn)} · Usuario #
                              {caso.registradoPor}
                            </small>
                            {caso.motivoResolucion && (
                              <small>
                                <CheckCircle2 aria-hidden size={12} />{" "}
                                {caso.motivoResolucion} · Usuario #
                                {caso.resueltoPor}
                              </small>
                            )}
                          </div>
                        ) : (
                          <>
                            <b>{stock.cantidad} físicas</b>
                            <small>
                              {stock.cantidadBloqueada} ya en cuarentena
                            </small>
                          </>
                        )}
                      </td>
                      <td>
                        <div className={g.acciones}>
                          {!caso?.resueltoEn && (
                            <button
                              type="button"
                              className={g.boton}
                              aria-label={`Imprimir etiqueta de ${stock.producto}`}
                              onClick={() => imprimir(stock, caso)}
                            >
                              <Printer aria-hidden size={14} /> Etiqueta
                            </button>
                          )}
                          {puedeRetirar && (
                            <button
                              type="button"
                              className={g.peligro}
                              onClick={() => {
                                cambio.reset();
                                setAccion({ tipo: "RETIRAR", stock });
                              }}
                            >
                              <PackageX aria-hidden size={14} /> Retirar
                            </button>
                          )}
                          {puedeResolver && (
                            <button
                              type="button"
                              className={g.primario}
                              onClick={() => {
                                cambio.reset();
                                setAccion({ tipo: "RESOLVER", stock, caso });
                              }}
                            >
                              Resolver
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal
        open={accion !== null}
        onOpenChange={(abierto) =>
          !cambio.isPending && !abierto && setAccion(null)
        }
        title={
          accion?.tipo === "RETIRAR"
            ? "Registrar retiro físico"
            : `Resolver caso #${accion?.tipo === "RESOLVER" ? accion.caso.id : ""}`
        }
        description={
          accion
            ? `${accion.stock.producto} · lote ${accion.stock.lote} · ${accion.stock.ubicacion}`
            : ""
        }
      >
        {accion && (
          <form
            className={g.form}
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              if (accion.tipo === "RETIRAR")
                cambio.mutate({
                  accion: "RETIRAR_VENCIDO",
                  stockId: accion.stock.id,
                  cantidad: Number(form.get("cantidad")),
                  motivo: String(form.get("motivo")),
                });
              else
                cambio.mutate({
                  accion: "RESOLVER",
                  casoId: accion.caso.id,
                  resolucion:
                    form.get("resolucion") === "LIBERADO"
                      ? "LIBERADO"
                      : "RECHAZADO",
                  motivo: String(form.get("motivo")),
                });
            }}
          >
            {cambio.error && (
              <p className={g.error} role="alert">
                {cambio.error.message}
              </p>
            )}
            {accion.tipo === "RETIRAR" ? (
              <label htmlFor={`${id}-cantidad`}>
                Unidades retiradas (máximo{" "}
                {accion.stock.cantidad - accion.stock.cantidadBloqueada})
                <input
                  id={`${id}-cantidad`}
                  name="cantidad"
                  type="number"
                  min={1}
                  max={accion.stock.cantidad - accion.stock.cantidadBloqueada}
                  defaultValue={
                    accion.stock.cantidad - accion.stock.cantidadBloqueada
                  }
                  required
                />
              </label>
            ) : (
              <fieldset className={styles.opciones}>
                <legend>Resolución</legend>
                {(() => {
                  const estado = etiquetaVencimiento(accion.stock.vencimiento);
                  const liberable =
                    estado.color !== "rojo" &&
                    estado.color !== "gris" &&
                    !accion.stock.vencimientoPorVerificar;
                  return (
                    <>
                      <label className={styles.opcion}>
                        <input
                          type="radio"
                          name="resolucion"
                          value="LIBERADO"
                          defaultChecked={liberable}
                          disabled={!liberable}
                        />
                        <span>
                          <b>Liberar de cuarentena</b>
                          <small>
                            {liberable
                              ? `Las ${accion.caso.cantidad} unidades vuelven a estar disponibles para dispensar.`
                              : "No disponible: el lote está vencido o su fecha no está confirmada."}
                          </small>
                        </span>
                      </label>
                      <label className={styles.opcion}>
                        <input
                          type="radio"
                          name="resolucion"
                          value="RECHAZADO"
                          defaultChecked={!liberable}
                        />
                        <span>
                          <b>Confirmar retiro físico</b>
                          <small>
                            Las unidades salen del stock y no se pueden
                            dispensar.
                          </small>
                        </span>
                      </label>
                    </>
                  );
                })()}
              </fieldset>
            )}
            <label htmlFor={`${id}-motivo`}>
              Motivo
              <textarea
                id={`${id}-motivo`}
                name="motivo"
                rows={3}
                minLength={3}
                maxLength={500}
                required
                placeholder={
                  accion.tipo === "RETIRAR"
                    ? "Ej. Retirado de vitrina para destrucción"
                    : "Ej. Revisión de rotulado conforme"
                }
              />
            </label>
            <button
              type="submit"
              className={accion.tipo === "RETIRAR" ? g.peligro : g.primario}
              disabled={cambio.isPending}
            >
              {accion.tipo === "RETIRAR"
                ? "Confirmar retiro"
                : "Confirmar resolución"}
            </button>
          </form>
        )}
      </Modal>

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

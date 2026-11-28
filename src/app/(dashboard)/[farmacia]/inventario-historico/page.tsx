import {
  ArrowDownLeft,
  ArrowUpRight,
  Repeat,
  SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import {
  type PharmacyParams,
  resolvePharmacy,
} from "@/lib/auth/pharmacy-scope";
import { requirePharmacyUser } from "@/lib/auth/session";
import { canOperate } from "@/lib/fefo";
import {
  historicoInventario,
  PERIODOS,
  TIPOS_MOVIMIENTO,
  type TipoMovimiento,
} from "@/lib/inventario-historico";
import { SinPermiso } from "../_components/solo-asistencial";
import styles from "./historico.module.css";

export const instant = false;

const ETIQUETA: Record<TipoMovimiento, string> = {
  ENTRADA: "Entrada",
  SALIDA: "Salida",
  AJUSTE: "Ajuste",
  TRASPASO: "Traspaso",
};
const ICONO = {
  ENTRADA: ArrowDownLeft,
  SALIDA: ArrowUpRight,
  AJUSTE: SlidersHorizontal,
  TRASPASO: Repeat,
};
const miles = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

export default async function InventarioHistoricoPage({
  params,
  searchParams,
}: PharmacyParams & {
  searchParams: Promise<{ tipo?: string; q?: string; dias?: string }>;
}) {
  const pharmacy = await resolvePharmacy(params);
  const user = await requirePharmacyUser(pharmacy);
  if (!canOperate(user, "inventario"))
    return <SinPermiso texto="Tu rol no tiene acceso al inventario." />;
  await connection();
  const sp = await searchParams;
  const tipo = (TIPOS_MOVIMIENTO as readonly string[]).includes(sp.tipo ?? "")
    ? (sp.tipo as TipoMovimiento)
    : undefined;
  const dias =
    PERIODOS.find((p) => String(p) === sp.dias) ??
    (30 as (typeof PERIODOS)[number]);
  const busqueda = (sp.q ?? "").slice(0, 60);
  const { movimientos, resumen, limite } = await historicoInventario(pharmacy, {
    tipo,
    busqueda,
    dias,
  });
  const privada = pharmacy === "privada";
  const href = (cambios: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    const v = {
      tipo,
      q: busqueda || undefined,
      dias: String(dias),
      ...cambios,
    };
    for (const [k, val] of Object.entries(v)) if (val) q.set(k, val);
    return `/${pharmacy}/inventario-historico?${q}`;
  };

  return (
    <section className="pos-shell">
      <header className="pos-header">
        <div>
          <h1>Inventario Histórico</h1>
          <span>
            Cada entrada, salida y ajuste de stock con su lote, motivo y
            responsable. Trazabilidad completa para auditorías.
          </span>
        </div>
      </header>

      <div className="pos-metrics">
        <div>
          <small>Unidades ingresadas</small>
          <strong className={styles.entrada}>
            +{miles(resumen.entradas.unidades)}
          </strong>
          <span className={styles.detalle}>
            {resumen.entradas.registros} entradas
          </span>
        </div>
        <div>
          <small>Unidades despachadas</small>
          <strong className={styles.salida}>
            −{miles(resumen.salidas.unidades)}
          </strong>
          <span className={styles.detalle}>
            {resumen.salidas.registros} salidas
          </span>
        </div>
        <div>
          <small>Ajustes</small>
          <strong>{resumen.ajustes.registros}</strong>
          <span className={styles.detalle}>
            {miles(resumen.ajustes.unidades)} unidades corregidas
          </span>
        </div>
        <div>
          <small>Movimientos del período</small>
          <strong>{miles(resumen.registros)}</strong>
          <span className={styles.detalle}>últimos {dias} días</span>
        </div>
      </div>

      <section className="pos-panel">
        <div className={styles.barra}>
          <nav className={styles.segmento} aria-label="Período">
            {PERIODOS.map((p) => (
              <Link
                key={p}
                href={href({ dias: String(p) })}
                aria-current={p === dias ? "page" : undefined}
              >
                {p === 365 ? "1 año" : `${p} días`}
              </Link>
            ))}
          </nav>
          <nav className={styles.segmento} aria-label="Tipo de movimiento">
            <Link
              href={href({ tipo: undefined })}
              aria-current={!tipo ? "page" : undefined}
            >
              Todos
            </Link>
            {TIPOS_MOVIMIENTO.map((t) => (
              <Link
                key={t}
                href={href({ tipo: t })}
                aria-current={t === tipo ? "page" : undefined}
              >
                {ETIQUETA[t]}
              </Link>
            ))}
          </nav>
          <form
            className={styles.buscar}
            action={`/${pharmacy}/inventario-historico`}
          >
            {tipo && <input type="hidden" name="tipo" value={tipo} />}
            <input type="hidden" name="dias" value={dias} />
            <input
              name="q"
              type="search"
              defaultValue={busqueda}
              maxLength={60}
              placeholder="Producto, lote o motivo"
              aria-label="Buscar movimientos"
            />
          </form>
        </div>

        {movimientos.length ? (
          <div className={styles.scroll}>
            <table className={styles.tabla}>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Movimiento</th>
                  <th>Producto · lote</th>
                  <th className={styles.num}>Unidades</th>
                  {privada && <th>Ubicación</th>}
                  <th>Motivo</th>
                  {privada && <th>Responsable</th>}
                </tr>
              </thead>
              <tbody>
                {movimientos.map((m) => {
                  const Icono = ICONO[m.tipo];
                  return (
                    <tr key={m.id}>
                      <td className={styles.fecha}>{m.fecha}</td>
                      <td>
                        <span className={styles.tipo} data-tipo={m.tipo}>
                          <Icono aria-hidden size={14} />
                          {ETIQUETA[m.tipo]}
                        </span>
                      </td>
                      <td>
                        <b>{m.producto}</b>
                        <small>Lote {m.lote}</small>
                      </td>
                      <td
                        className={`${styles.num} ${styles.cantidad}`}
                        data-tipo={m.tipo}
                      >
                        {m.tipo === "SALIDA"
                          ? "−"
                          : m.tipo === "ENTRADA"
                            ? "+"
                            : ""}
                        {miles(m.cantidad)}
                      </td>
                      {privada && <td>{m.ubicacion ?? "—"}</td>}
                      <td className={styles.motivo}>{m.motivo || "—"}</td>
                      {privada && <td>{m.usuario ?? "Sistema"}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="pos-empty">
            No hay movimientos
            {tipo ? ` de tipo ${ETIQUETA[tipo].toLowerCase()}` : ""} en los
            últimos {dias} días{busqueda ? ` para «${busqueda}»` : ""}.
          </p>
        )}
        {movimientos.length >= limite && (
          <p className="pos-footnote">
            Se muestran los {limite} movimientos más recientes; acota el período
            o busca un producto para ver el resto.
          </p>
        )}
      </section>
    </section>
  );
}

"use client";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Boxes,
  CalendarDays,
  CircleAlert,
  Clock3,
  Package,
  Receipt,
  RefreshCw,
  ShoppingCart,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { dashboardSummary } from "@/lib/dashboard-summary";
import type { DashboardData } from "@/lib/types/panel";
import styles from "./panel.module.css";
import {
  money,
  number,
  PaymentChart,
  SalesChart,
  shortDay,
} from "./panel-charts";

function Change({ current, previous }: { current: number; previous: number }) {
  if (previous === 0)
    return <span className={styles.metricNote}>Sin base de comparación</span>;
  const change = ((current - previous) / previous) * 100;
  return (
    <span
      className={`${styles.metricNote} ${change < 0 ? styles.negative : ""}`}
    >
      {change < 0 ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
      <b>
        {Math.abs(change).toLocaleString("es-CL", { maximumFractionDigits: 1 })}
        %
      </b>{" "}
      vs. período anterior
    </span>
  );
}

export function Dashboard({ data }: { data: DashboardData }) {
  const [days, setDays] = useState(14);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const summary = dashboardSummary(data, days);
  const available = data.disponibles;
  const totalUnits =
    data.inventario.vigente + data.inventario.proximo + data.inventario.vencido;
  const date = new Intl.DateTimeFormat("es-CL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Santiago",
  }).format(new Date(data.actualizado));
  const time = new Intl.DateTimeFormat("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Santiago",
  }).format(new Date(data.actualizado));
  return (
    <div className={styles.dashboard}>
      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}>
            <span />
            Resumen de la farmacia
          </div>
          <h1>Panel</h1>
          <p>Una mirada a tus ventas, productos e inventario.</p>
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.refresh}
            onClick={() => startTransition(() => router.refresh())}
            disabled={pending}
            aria-label="Actualizar dashboard"
            title={`Actualizado a las ${time}`}
          >
            <RefreshCw size={17} className={pending ? styles.spinning : ""} />
          </button>
        </div>
      </header>
      <div className={styles.contextRow}>
        <span>
          <CalendarDays size={15} />
          {date}
        </span>
        <div
          className={styles.period}
          role="group"
          aria-label="Período de ventas"
        >
          {[7, 14, 30].map((value) => (
            <button
              key={value}
              aria-pressed={days === value}
              onClick={() => setDays(value)}
            >
              Últimos {value} días
            </button>
          ))}
        </div>
      </div>
      <section
        className={styles.metrics}
        aria-label={`Indicadores de los últimos ${days} días`}
      >
        <article className={`${styles.metric} ${styles.featuredMetric}`}>
          <div className={styles.metricTop}>
            <span>Ventas del período</span>
            <Wallet size={19} />
          </div>
          <strong>{money(summary.total)}</strong>
          <Change current={summary.total} previous={summary.previousTotal} />
        </article>
        <article className={styles.metric}>
          <div className={styles.metricTop}>
            <span>Ventas registradas</span>
            <Receipt size={19} />
          </div>
          <strong>{number(summary.sales.length)}</strong>
          <Change
            current={summary.sales.length}
            previous={summary.previousCount}
          />
        </article>
        <article className={styles.metric}>
          <div className={styles.metricTop}>
            <span>Ticket promedio</span>
            <ShoppingCart size={19} />
          </div>
          <strong>{money(summary.average)}</strong>
          <span className={styles.metricNote}>Promedio por operación</span>
        </article>
        <article className={styles.metric}>
          <div className={styles.metricTop}>
            <span>Unidades disponibles</span>
            <Boxes size={19} />
          </div>
          <strong>{number(available)}</strong>
          <span className={styles.metricNote}>
            {number(data.activos)} productos activos · Inventario actual
          </span>
        </article>
      </section>
      <div className={styles.chartsGrid}>
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h2>Evolución de ventas</h2>
              <p>Ingresos diarios en pesos chilenos</p>
            </div>
            <span className={styles.chartLegend}>
              <i />
              Ventas
            </span>
          </div>
          <SalesChart key={days} points={summary.daily} total={summary.total} />
          <div className={styles.chartFooter}>
            <span>Últimos {days} días</span>
            <Link href="/privada/reportes">
              Ver reportes
              <ArrowRight size={14} />
            </Link>
          </div>
        </section>
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h2>Medios de pago</h2>
              <p>Distribución del monto vendido</p>
            </div>
          </div>
          <PaymentChart payments={summary.payments} total={summary.total} />
        </section>
      </div>
      <div className={styles.twoColumns}>
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h2>Productos más vendidos</h2>
              <p>Por unidades · Últimos {days} días</p>
            </div>
            <Link className={styles.subtleLink} href="/privada/productos">
              Productos
              <ArrowUpRight size={15} />
            </Link>
          </div>
          {summary.top.length ? (
            <div className={styles.topProducts}>
              {summary.top.map((product, index) => (
                <div key={product.id}>
                  <span className={styles.rank}>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className={styles.productBar}>
                    <div>
                      <span>{product.nombre}</span>
                      <strong>
                        {number(product.cantidad)} <small>un.</small>
                      </strong>
                    </div>
                    <div className={styles.track}>
                      <span
                        style={{
                          width: `${(product.cantidad / summary.top[0].cantidad) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.empty}>
              <Package size={28} strokeWidth={1.4} />
              <strong>Sin productos vendidos</strong>
              <p>Aquí verás los productos con más movimiento.</p>
            </div>
          )}
        </section>
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h2>Estado del inventario</h2>
              <p>Existencias actuales · {number(data.productos)} productos</p>
            </div>
            <Link className={styles.subtleLink} href="/privada/stock-y-lotes">
              Inventario
              <ArrowUpRight size={15} />
            </Link>
          </div>
          <div className={styles.inventoryTotal}>
            <strong>{number(totalUnits)}</strong>
            <span>unidades registradas</span>
          </div>
          <div
            className={styles.inventoryBar}
            role="img"
            aria-label={`${number(data.inventario.vigente)} vigentes, ${number(data.inventario.proximo)} próximas a vencer y ${number(data.inventario.vencido)} vencidas`}
          >
            {[
              data.inventario.vigente,
              data.inventario.proximo,
              data.inventario.vencido,
            ].map((value, index) => (
              <span
                key={index}
                className={styles[`inventory${index}`]}
                style={{
                  width: `${totalUnits ? (value / totalUnits) * 100 : 0}%`,
                }}
              />
            ))}
          </div>
          <div className={styles.inventoryLegend}>
            {[
              ["Vigentes", data.inventario.vigente],
              ["Vencen en 30 días", data.inventario.proximo],
              ["Vencidas", data.inventario.vencido],
            ].map(([label, value], index) => (
              <div key={label}>
                <span>
                  <i className={styles[`inventory${index}`]} />
                  {label}
                </span>
                <strong>{number(Number(value))}</strong>
              </div>
            ))}
          </div>
          <p className={styles.inventoryHint}>
            Las unidades vencidas no se incluyen en el stock disponible.
          </p>
        </section>
      </div>
      <div className={styles.twoColumns}>
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h2>
                <CircleAlert size={17} />
                Productos con stock bajo
              </h2>
              <p>Disponibles iguales o inferiores al mínimo</p>
            </div>
            <span className={styles.countBadge}>{data.bajos.length}</span>
          </div>
          {data.bajos.length ? (
            <div className={styles.alertList}>
              {data.bajos.slice(0, 4).map((product) => (
                <Link href="/privada/stock-y-lotes" key={product.id}>
                  <span>
                    {product.nombre}
                    <small>Mínimo: {number(product.minimo)} unidades</small>
                  </span>
                  <b
                    className={
                      product.cantidad === 0
                        ? styles.redBadge
                        : styles.amberBadge
                    }
                  >
                    {number(product.cantidad)} disponibles
                  </b>
                </Link>
              ))}
            </div>
          ) : (
            <div className={styles.smallEmpty}>
              No hay productos bajo su stock mínimo.
            </div>
          )}
        </section>
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h2>
                <Clock3 size={17} />
                Lotes que requieren atención
              </h2>
              <p>Vencidos o próximos a vencer en 30 días</p>
            </div>
            <span className={styles.countBadge}>
              {data.vencimientos.length}
            </span>
          </div>
          {data.vencimientos.length ? (
            <div className={styles.alertList}>
              {data.vencimientos.slice(0, 4).map((lot) => (
                <Link href="/privada/stock-y-lotes" key={lot.id}>
                  <span>
                    {lot.nombre}
                    <small>
                      Lote {lot.lote} · {number(lot.cantidad)} unidades
                    </small>
                  </span>
                  <b
                    className={
                      lot.dias <= 1
                        ? styles.redBadge
                        : lot.dias <= 7
                          ? styles.amberBadge
                          : styles.neutralBadge
                    }
                  >
                    {lot.dias < 0
                      ? "Vencido"
                      : lot.dias === 0
                        ? "Vence hoy"
                        : lot.dias === 1
                          ? "Vence en 1 día"
                          : `Vence en ${lot.dias} días`}
                  </b>
                </Link>
              ))}
            </div>
          ) : (
            <div className={styles.smallEmpty}>
              No hay lotes con vencimiento cercano.
            </div>
          )}
        </section>
      </div>
      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <h2>Ventas recientes</h2>
            <p>Últimas operaciones del período seleccionado</p>
          </div>
          <Link className={styles.subtleLink} href="/privada/historial">
            Ver historial
            <ArrowRight size={15} />
          </Link>
        </div>
        {summary.sales.length ? (
          <div className={styles.tableScroll}>
            <table className={styles.recentTable}>
              <thead>
                <tr>
                  <th>Operación</th>
                  <th>Fecha y hora</th>
                  <th>Medio de pago</th>
                  <th>Unidades</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {summary.sales.slice(0, 5).map((sale) => (
                  <tr key={sale.id}>
                    <td>
                      <Link href="/privada/historial">Venta #{sale.id}</Link>
                    </td>
                    <td>
                      {shortDay(sale.dia)} ·{" "}
                      {new Date(sale.fecha).toLocaleTimeString("es-CL", {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "America/Santiago",
                      })}
                    </td>
                    <td>
                      <span className={styles.paymentBadge}>
                        {summary.payments.find(
                          (payment) => payment.id === sale.metodo,
                        )?.label ?? sale.metodo}
                      </span>
                    </td>
                    <td>
                      {number(
                        sale.items.reduce(
                          (sum, item) => sum + item.cantidad,
                          0,
                        ),
                      )}
                    </td>
                    <td>{money(sale.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.smallEmpty}>
            No hay ventas registradas en estos {days} días.
          </div>
        )}
      </section>
      <footer className={styles.dashboardFooter}>
        <span>Registro interno de ventas · Montos en CLP</span>
        <span>Actualizado a las {time}</span>
      </footer>
    </div>
  );
}

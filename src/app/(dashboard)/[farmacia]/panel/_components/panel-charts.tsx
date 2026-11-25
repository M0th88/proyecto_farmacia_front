"use client";
import { useId, useState } from "react";
import styles from "./panel.module.css";

export const money = (value: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value);
export const number = (value: number) =>
  new Intl.NumberFormat("es-CL").format(value);
export const shortDay = (day: string) =>
  new Intl.DateTimeFormat("es-CL", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00Z`));
const compactMoney = (value: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

export function SalesChart({
  points,
  total,
}: {
  points: { dia: string; total: number }[];
  total: number;
}) {
  const id = useId().replace(/:/g, "");
  const [active, setActive] = useState<number | null>(null);
  const peak = Math.max(...points.map((point) => point.total), 1);
  const magnitude = 10 ** Math.floor(Math.log10(peak));
  const maximum = Math.ceil(peak / magnitude) * magnitude;
  const x = (index: number) =>
    60 + (index / Math.max(points.length - 1, 1)) * 600;
  const y = (amount: number) => 218 - (amount / maximum) * 184;
  const line = points
    .map((point, index) => `${index ? "L" : "M"}${x(index)},${y(point.total)}`)
    .join(" ");
  const selected = active !== null ? points[active] : null;
  return (
    <>
      <div className={styles.chartValue}>
        <strong>{money(selected?.total ?? total)}</strong>
        <span>{selected ? shortDay(selected.dia) : "Total del período"}</span>
      </div>
      {total === 0 ? (
        <div className={styles.chartEmpty}>
          <span className={styles.emptyLine} />
          <strong>Aún no hay ventas en este período</strong>
          <p>Las operaciones registradas en POS aparecerán aquí.</p>
        </div>
      ) : (
        <svg
          className={styles.salesSvg}
          viewBox="0 0 680 260"
          role="img"
          aria-label="Evolución de ventas diarias en pesos chilenos"
          onMouseLeave={() => setActive(null)}
        >
          <defs>
            <linearGradient id={`${id}-area`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d42d10" stopOpacity="0.17" />
              <stop offset="100%" stopColor="#d42d10" stopOpacity="0.01" />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3, 4].map((index) => {
            const value = (maximum * index) / 4;
            return (
              <g key={index}>
                <line
                  x1={60}
                  x2={660}
                  y1={y(value)}
                  y2={y(value)}
                  stroke="#eceef1"
                  strokeDasharray={index ? "4 5" : undefined}
                />
                <text
                  x={49}
                  y={y(value) + 4}
                  textAnchor="end"
                  className={styles.axisText}
                >
                  {compactMoney(value)}
                </text>
              </g>
            );
          })}
          <path d={`${line} L660,218 L60,218 Z`} fill={`url(#${id}-area)`} />
          <path
            d={line}
            fill="none"
            stroke="#d42d10"
            strokeWidth={2.8}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {points.map((point, index) => (
            <g key={point.dia}>
              {(index % Math.ceil(points.length / 6) === 0 ||
                index === points.length - 1) && (
                <text
                  x={x(index)}
                  y={246}
                  textAnchor={
                    index === points.length - 1
                      ? "end"
                      : index === 0
                        ? "start"
                        : "middle"
                  }
                  className={styles.axisText}
                >
                  {shortDay(point.dia)}
                </text>
              )}
              <circle
                cx={x(index)}
                cy={y(point.total)}
                r={active === index ? 5 : 3}
                fill="#fff"
                stroke="#d42d10"
                strokeWidth={2}
              />
              <circle
                cx={x(index)}
                cy={y(point.total)}
                r={12}
                fill="transparent"
                tabIndex={0}
                role="img"
                aria-label={`${shortDay(point.dia)}: ${money(point.total)}`}
                onMouseEnter={() => setActive(index)}
                onFocus={() => setActive(index)}
                onBlur={() => setActive(null)}
              >
                <title>
                  {shortDay(point.dia)}: {money(point.total)}
                </title>
              </circle>
            </g>
          ))}
          {active !== null && (
            <line
              x1={x(active)}
              x2={x(active)}
              y1={28}
              y2={218}
              stroke="#d42d10"
              opacity={0.2}
              strokeDasharray="3 4"
              pointerEvents="none"
            />
          )}
        </svg>
      )}
    </>
  );
}

const paymentColors = ["#d42d10", "#272b33", "#e29988", "#cbd0d8"];
export function PaymentChart({
  payments,
  total,
}: {
  payments: { id: string; label: string; total: number }[];
  total: number;
}) {
  let progress = 0;
  const gradient = payments
    .map((payment, index) => {
      const start = progress;
      progress += total ? (payment.total / total) * 100 : 0;
      return `${paymentColors[index]} ${start}% ${progress}%`;
    })
    .join(", ");
  return (
    <div className={styles.paymentContent}>
      <div
        className={styles.donut}
        style={{
          background: total ? `conic-gradient(${gradient})` : "#eceef1",
        }}
        role="img"
        aria-label={
          total
            ? `Ventas por medio de pago: ${payments.map((payment) => `${payment.label} ${money(payment.total)}`).join(", ")}`
            : "Sin ventas para distribuir"
        }
      >
        <div>
          <span>Total vendido</span>
          <strong title={money(total)}>{compactMoney(total)}</strong>
        </div>
      </div>
      <div className={styles.paymentLegend}>
        {payments.map((payment, index) => (
          <div key={payment.id}>
            <span>
              <i style={{ background: paymentColors[index] }} />
              {payment.label}
            </span>
            <strong>
              {total ? Math.round((payment.total / total) * 100) : 0}%
            </strong>
            <small>{money(payment.total)}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

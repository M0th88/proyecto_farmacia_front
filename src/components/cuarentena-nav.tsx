import Link from "next/link";
import type { Pharmacy } from "@/lib/auth/pharmacies";
import type { VistaInventario } from "@/lib/types/cuarentena";
import styles from "./cuarentena-nav.module.css";

const VISTAS: { vista: VistaInventario; href: string; label: string }[] = [
  { vista: "SEGREGAR", href: "segregar-productos", label: "Segregar" },
  {
    vista: "TRANSITORIA",
    href: "cuarentena-transitoria",
    label: "Transitoria",
  },
  { vista: "SANITARIA", href: "cuarentena-sanitaria", label: "Sanitaria" },
  { vista: "VENCIDOS", href: "productos-vencidos", label: "Vencidos" },
];

/** Pestañas del circuito de segregación: dónde está el producto bloqueado. */
export function CuarentenaNav({
  farmacia,
  actual,
}: {
  farmacia: Pharmacy;
  actual: VistaInventario;
}) {
  return (
    <nav className={styles.nav} aria-label="Circuito de segregación">
      {VISTAS.map((v, i) => (
        <Link
          key={v.vista}
          href={`/${farmacia}/${v.href}`}
          aria-current={v.vista === actual ? "page" : undefined}
        >
          <span className={styles.paso} aria-hidden>
            {i + 1}
          </span>
          {v.label}
        </Link>
      ))}
      <Link className={styles.externo} href={`/${farmacia}/stocks-y-lotes`}>
        Stocks y Lotes →
      </Link>
    </nav>
  );
}

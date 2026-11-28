import { ArrowRight, Construction } from "lucide-react";
import Link from "next/link";
import {
  type PharmacyParams,
  resolvePharmacy,
} from "@/lib/auth/pharmacy-scope";
import styles from "./empty-private-section.module.css";

export type ModuloPendiente = {
  title: string;
  /** Qué problema resuelve el módulo, en una frase. */
  description?: string;
  /** Lo que hará cuando esté listo. */
  planned?: string[];
  /** Secciones existentes que sirven mientras tanto (ruta sin farmacia). */
  related?: { label: string; href: string }[];
};

/** Sección del menú aún no implementada: explica su alcance y deriva a lo existente. */
export async function EmptyPrivateSection({
  params,
  title,
  description = "Por ahora esta sección funciona en Farmacia Privada; se habilitará en Asistencial en una próxima etapa.",
  planned = [
    "Replicar en Asistencial el mismo flujo que ya opera en Farmacia Privada.",
  ],
  related = [
    { label: "Stocks y Lotes", href: "/stocks-y-lotes" },
    { label: "Inventario Histórico", href: "/inventario-historico" },
  ],
}: ModuloPendiente & Partial<PharmacyParams>) {
  const pharmacy = params ? await resolvePharmacy(params) : "privada";
  return (
    <section className="pos-shell">
      <header className="pos-header">
        <div>
          <h1>{title}</h1>
          <span>{description}</span>
        </div>
      </header>
      <section className={`pos-panel ${styles.tarjeta}`}>
        <div className={styles.icono} aria-hidden>
          <Construction size={26} />
        </div>
        <div className={styles.cuerpo}>
          <p className={styles.estado}>Módulo en desarrollo</p>
          <h2>Qué hará esta sección</h2>
          <ol className={styles.plan}>
            {planned.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
          {related.length > 0 && (
            <>
              <h3>Mientras tanto puedes usar</h3>
              <ul className={styles.relacionados}>
                {related.map((r) => (
                  <li key={r.href}>
                    <Link href={`/${pharmacy}${r.href}`}>
                      {r.label}
                      <ArrowRight aria-hidden size={15} />
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>
    </section>
  );
}

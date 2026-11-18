import { ArrowRight, ArrowUpRight, Hospital, Pill } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.entry}>
      <header className={styles.header}>
        <Image
          className={styles.logo}
          src="/inacap.svg"
          alt="INACAP"
          width={567}
          height={153}
          loading="eager"
        />
        <span className={styles.systemName}>Sistema de farmacia</span>
      </header>
      <section className={styles.content} aria-labelledby="entry-title">
        <div className={styles.intro}>
          <span className={styles.eyebrow}>
            Bienvenido a tu espacio de trabajo
          </span>
          <h1 id="entry-title">Selecciona tu farmacia</h1>
          <p>Elige el entorno al que deseas ingresar para continuar.</p>
        </div>
        <nav className={styles.options} aria-label="Seleccionar farmacia">
          <Link
            href="/login/privada"
            className={styles.card}
            aria-labelledby="private-title"
            aria-describedby="private-description"
          >
            <div className={styles.cardTop}>
              <span className={styles.icon}>
                <Pill size={28} strokeWidth={1.6} aria-hidden="true" />
              </span>
              <ArrowUpRight
                className={styles.cornerArrow}
                size={22}
                strokeWidth={1.5}
                aria-hidden="true"
              />
            </div>
            <div className={styles.cardBody}>
              <span className={styles.category}>Gestión y operación</span>
              <h2 id="private-title">Farmacia Privada</h2>
              <p id="private-description">
                Productos, inventario y operación de venta en un mismo lugar.
              </p>
            </div>
            <span className={styles.cardAction}>
              Ingresar a Farmacia Privada
              <ArrowRight size={19} aria-hidden="true" />
            </span>
          </Link>
          <Link
            href="/login/asistencial"
            className={styles.card}
            aria-labelledby="assistance-title"
            aria-describedby="assistance-description"
          >
            <div className={styles.cardTop}>
              <span className={styles.icon}>
                <Hospital size={28} strokeWidth={1.6} aria-hidden="true" />
              </span>
              <ArrowUpRight
                className={styles.cornerArrow}
                size={22}
                strokeWidth={1.5}
                aria-hidden="true"
              />
            </div>
            <div className={styles.cardBody}>
              <span className={styles.category}>Entorno asistencial</span>
              <h2 id="assistance-title">Farmacia Asistencial</h2>
              <p id="assistance-description">
                Accede a las herramientas de tu espacio de trabajo asistencial.
              </p>
            </div>
            <span className={styles.cardAction}>
              Ingresar a Farmacia Asistencial
              <ArrowRight size={19} aria-hidden="true" />
            </span>
          </Link>
        </nav>
        <p className={styles.hint}>
          Utiliza las credenciales correspondientes a tu farmacia.
        </p>
      </section>
      <footer className={styles.footer}>
        <span>INACAP</span>
        <span>Sistema de gestión de farmacia</span>
      </footer>
    </main>
  );
}

import Image from "next/image";
import Link from "next/link";
import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.entry}>
      <div className={styles.content}>
        <Image
          className={styles.logo}
          src="/inacap.svg"
          alt="INACAP"
          width={567}
          height={153}
          loading="eager"
        />
        <nav className={styles.options} aria-label="Seleccionar farmacia">
          <Link href="/login/privada" className={styles.button}>
            Iniciar en Farmacia Privada
          </Link>
          <Link href="/login/asistencial" className={styles.button}>
            Iniciar en Farmacia Asistencial
          </Link>
        </nav>
      </div>
    </main>
  );
}

"use client";

import { Printer } from "lucide-react";
import { useEffect, useRef } from "react";
import styles from "./documento-venta.module.css";

export function ImprimirVenta({ abrirDialogo }: { abrirDialogo: boolean }) {
  const dialogoAbierto = useRef(false);
  useEffect(() => {
    if (!abrirDialogo || dialogoAbierto.current) return;

    const frame = window.requestAnimationFrame(() => {
      dialogoAbierto.current = true;
      window.print();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [abrirDialogo]);

  return (
    <button
      type="button"
      className={styles.printButton}
      onClick={() => window.print()}
    >
      <Printer size={17} aria-hidden="true" />
      Imprimir o guardar como PDF
    </button>
  );
}

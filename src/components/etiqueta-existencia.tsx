import type { ExistenciaCuarentena } from "@/lib/types/cuarentena";
import styles from "./etiqueta-inventario.module.css";

export function EtiquetaExistencia({
  stock,
  estado,
  caso,
}: {
  stock: ExistenciaCuarentena;
  estado: { color: string; texto: string };
  caso?: { id: number; cantidad: number };
}) {
  const fecha =
    stock.rotulo || stock.vencimiento?.split("-").reverse().join("/");
  return (
    <div id="etiquetas-productos" className={styles.impresion}>
      <article className={styles.etiqueta} data-color={estado.color}>
        <span className={styles.estado} data-color={estado.color}>
          {estado.texto}
        </span>
        <strong>{stock.producto}</strong>
        <div>
          Lote {stock.lote} · {stock.ubicacion}
        </div>
        {fecha && <div>Vencimiento {fecha}</div>}
        {stock.vencimientoPorVerificar && <small>Fecha por verificar</small>}
        {caso && (
          <div>
            Caso #{caso.id} · {caso.cantidad} unidades
          </div>
        )}
      </article>
    </div>
  );
}

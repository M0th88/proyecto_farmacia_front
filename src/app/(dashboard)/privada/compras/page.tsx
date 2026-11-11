import Link from "next/link";

export default function ComprasPage() {
  return (
    <section className="pos-shell">
      <header className="pos-header">
        <div>
          <Link href="/">← Panel principal</Link>
          <p>FARMACIA PRIVADA / ABASTECIMIENTO</p>
          <h1>Compras</h1>
          <span>
            Órdenes a proveedores y recepción de medicamentos por lote.
          </span>
        </div>
      </header>
      <div className="pos-grid">
        <section className="pos-panel">
          <div className="pos-title">
            <div>
              <small>ÓRDENES DE COMPRA</small>
              <h2>Seguimiento</h2>
            </div>
            <span>0 órdenes</span>
          </div>
          <div className="pos-empty">
            <b>Sin órdenes registradas</b>
            <p>
              La creación y recepción se conectarán al directorio de
              proveedores. Recibir una orden deberá crear los lotes y
              movimientos de entrada en una sola transacción.
            </p>
          </div>
        </section>
        <aside className="pos-panel">
          <div className="pos-title">
            <div>
              <small>FLUJO PREVISTO</small>
              <h2>De pedido a bodega</h2>
            </div>
          </div>
          <ol className="purchase-steps">
            <li>Elegir proveedor y productos.</li>
            <li>Registrar cantidad, costo y fecha esperada.</li>
            <li>Emitir la orden de compra.</li>
            <li>Recibir con número de lote y vencimiento.</li>
            <li>Actualizar stock y trazabilidad.</li>
          </ol>
          <p className="pos-footnote">
            No se crea stock desde esta pantalla hasta implementar validación y
            permisos.
          </p>
        </aside>
      </div>
    </section>
  );
}

export function OperacionesDeVenta({
  lineas,
}: {
  lineas: { id: number; nombre: string; lote: string; cantidad: number }[];
}) {
  return (
    <section className="pos-panel pos-operaciones">
      <h2>Anulaciones y devoluciones</h2>
      <p>
        Estas operaciones aún no están disponibles. El registro de la venta y el
        inventario se conservan al consultar esta pantalla.
      </p>
      <details className="pos-operacion">
        <summary>Anular venta completa</summary>
        <div className="pos-pay">
          <label>
            Motivo de anulación
            <input type="text" />
          </label>
          <label>
            Referencia de reversa del pago
            <input type="text" />
          </label>
        </div>
        <button type="button" disabled>
          Confirmar anulación
        </button>
      </details>
      <details className="pos-operacion">
        <summary>Devolver productos</summary>
        <div className="pos-pay">
          {lineas.map((linea) => (
            <label key={linea.id}>
              {linea.nombre} · Lote {linea.lote} · Máx. {linea.cantidad}
              <input
                type="number"
                min="0"
                max={linea.cantidad}
                step="1"
                placeholder="Cantidad a devolver"
              />
            </label>
          ))}
          <label>
            Motivo de devolución
            <input type="text" />
          </label>
          <label>
            Medio de reembolso
            <select>
              <option>Medio de pago original</option>
              <option>Efectivo</option>
              <option>Transferencia</option>
            </select>
          </label>
        </div>
        <button type="button" disabled>
          Confirmar devolución
        </button>
      </details>
    </section>
  );
}

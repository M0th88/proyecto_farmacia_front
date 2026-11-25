export function ControlesDeCaja() {
  return (
    <section className="pos-panel pos-operaciones">
      <h2>Turno de caja</h2>
      <p>
        La gestión de turnos y el registro de efectivo aún no están disponibles.
      </p>
      <details className="pos-operacion">
        <summary>Apertura de caja</summary>
        <div className="pos-pay">
          <label>
            Fondo inicial (CLP)
            <input type="number" min="0" step="1" />
          </label>
          <label>
            Observaciones
            <input type="text" />
          </label>
        </div>
        <button type="button" disabled>
          Abrir caja
        </button>
      </details>
      <details className="pos-operacion">
        <summary>Movimientos de efectivo</summary>
        <div className="pos-pay">
          <label>
            Tipo
            <select>
              <option>Ingreso</option>
              <option>Retiro</option>
            </select>
          </label>
          <label>
            Monto (CLP)
            <input type="number" min="0" step="1" />
          </label>
          <label>
            Motivo
            <input type="text" />
          </label>
        </div>
        <button type="button" disabled>
          Registrar movimiento
        </button>
      </details>
      <details className="pos-operacion">
        <summary>Cierre y arqueo</summary>
        <div className="pos-pay">
          <label>
            Efectivo contado (CLP)
            <input type="number" min="0" step="1" />
          </label>
          <label>
            Total comprobado en el terminal (CLP)
            <input type="number" min="0" step="1" />
          </label>
          <label>
            Observaciones
            <input type="text" />
          </label>
        </div>
        <p>
          El efectivo esperado y la diferencia aparecerán cuando se habilite el
          registro por turno.
        </p>
        <button type="button" disabled>
          Cerrar caja
        </button>
      </details>
    </section>
  );
}

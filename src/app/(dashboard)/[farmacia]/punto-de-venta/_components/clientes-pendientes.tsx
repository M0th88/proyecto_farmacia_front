export function ClientesPendientes() {
  return (
    <details className="pos-panel pos-operacion">
      <summary>Gestión de clientes</summary>
      <p>
        El registro y la búsqueda de clientes aún no están disponibles. Los
        datos de factura se pueden guardar al confirmar una venta.
      </p>
      <div className="pos-pay">
        <label>
          Buscar por RUT o nombre
          <input type="search" placeholder="RUT, nombre o razón social" />
        </label>
        <button type="button" disabled>
          Buscar cliente
        </button>
        <label>
          RUT
          <input type="text" />
        </label>
        <label>
          Nombre o razón social
          <input type="text" />
        </label>
        <label>
          Correo electrónico
          <input type="email" />
        </label>
        <label>
          Teléfono
          <input type="tel" />
        </label>
      </div>
      <button type="button" disabled>
        Guardar cliente
      </button>
    </details>
  );
}

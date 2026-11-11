import Link from "next/link";
import { requirePharmacyUser } from "@/lib/auth/session";
import { prismaPrivada } from "@/lib/db/prisma-privada";

export const instant = false;
const pesos = (n: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(n);

export default async function ProductosPage() {
  await requirePharmacyUser("privada");
  const productos = await prismaPrivada.medicamento.findMany({
    orderBy: { nombre: "asc" },
    include: { categoria: true, lotes: { include: { stocks: true } } },
  });
  return (
    <section className="pos-shell">
      <header className="pos-header">
        <div>
          <Link href="/">← Panel principal</Link>
          <p>FARMACIA PRIVADA / PRODUCTOS</p>
          <h1>Productos</h1>
          <span>Fichas, precios y códigos de barras de la base privada.</span>
        </div>
      </header>
      <div className="pos-metrics">
        <div>
          <small>Productos</small>
          <strong>{productos.length}</strong>
        </div>
        <div>
          <small>Sin precio</small>
          <strong>
            {productos.filter((p) => p.precioVenta === null).length}
          </strong>
        </div>
        <div>
          <small>Sin código de barras</small>
          <strong>{productos.filter((p) => !p.codigoBarra).length}</strong>
        </div>
        <div>
          <small>Sin clasificar</small>
          <strong>
            {
              productos.filter((p) => p.condicionVenta === "SIN_CLASIFICAR")
                .length
            }
          </strong>
        </div>
      </div>
      <section className="pos-panel">
        <div className="pos-title">
          <div>
            <small>PRODUCTOS REGISTRADOS</small>
            <h2>Fichas de medicamentos</h2>
          </div>
        </div>
        <div className="catalog-table-wrap">
          <table className="catalog-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Código de barras</th>
                <th>Condición</th>
                <th>Precio venta</th>
                <th>Stock</th>
              </tr>
            </thead>
            <tbody>
              {productos.map((p) => (
                <tr key={p.id}>
                  <td>
                    <b>{p.nombre}</b>
                    <small>
                      {p.codigoCatalogo ??
                        p.categoria?.nombre ??
                        "Sin categoría"}{" "}
                      · {p.principioActivo ?? "Sin principio activo"}
                    </small>
                  </td>
                  <td>{p.codigoBarra ?? "Pendiente"}</td>
                  <td>
                    <span className="catalog-tag">
                      {p.condicionVenta.replaceAll("_", " ")}
                    </span>
                  </td>
                  <td>
                    {p.precioVenta === null
                      ? "Pendiente"
                      : pesos(Number(p.precioVenta))}
                  </td>
                  <td>
                    {p.lotes.reduce(
                      (n, l) =>
                        n + l.stocks.reduce((s, x) => s + x.cantidad, 0),
                      0,
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!productos.length && (
          <p className="pos-empty">No hay productos en la base privada.</p>
        )}
        <p className="pos-footnote">
          La edición de fichas se incorporará con permisos de usuario y registro
          de cambios.
        </p>
      </section>
    </section>
  );
}

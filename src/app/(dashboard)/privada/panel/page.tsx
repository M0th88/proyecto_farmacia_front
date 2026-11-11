import Link from "next/link";
import { requirePharmacyUser } from "@/lib/auth/session";
import { prismaPrivada } from "@/lib/db/prisma-privada";

export const instant = false;

const secciones = [
  {
    titulo: "POS",
    descripcion: "Escanear productos, preparar el carrito y registrar cobros.",
    ruta: "/privada/punto-de-venta",
    icono: "01",
    accion: "Abrir caja",
  },
  {
    titulo: "Productos",
    descripcion: "Consultar medicamentos, precios y códigos de barras.",
    ruta: "/privada/productos",
    icono: "02",
    accion: "Ver productos",
  },
  {
    titulo: "Stock y lotes",
    descripcion: "Revisar stock, lotes, mínimos y vencimientos.",
    ruta: "/privada/stock-y-lotes",
    icono: "03",
    accion: "Revisar stock",
  },
  {
    titulo: "Proveedores",
    descripcion: "Directorio para el abastecimiento de la farmacia.",
    ruta: "/privada/proveedores",
    icono: "04",
    accion: "Ver proveedores",
  },
  {
    titulo: "Compras",
    descripcion: "Órdenes y recepción de productos por lote.",
    ruta: "/privada/compras",
    icono: "05",
    accion: "Ver compras",
  },
  {
    titulo: "Caja",
    descripcion: "Resumen del día por medio de pago.",
    ruta: "/privada/caja",
    icono: "06",
    accion: "Ver caja",
  },
  {
    titulo: "Historial",
    descripcion: "Historial de operaciones y detalle por lote.",
    ruta: "/privada/historial",
    icono: "07",
    accion: "Ver historial",
  },
  {
    titulo: "Reportes",
    descripcion: "Tendencia y resumen de ventas recientes.",
    ruta: "/privada/reportes",
    icono: "08",
    accion: "Ver reportes",
  },
  {
    titulo: "Usuarios y roles",
    descripcion: "Crear perfiles y asignar permisos de acceso.",
    ruta: "/privada/usuarios-y-roles",
    icono: "09",
    accion: "Administrar perfiles",
  },
] as const;

export default async function PanelPage() {
  await requirePharmacyUser("privada");
  const [productos, ventas, totales] = await Promise.all([
    prismaPrivada.medicamento.count(),
    prismaPrivada.venta.count(),
    prismaPrivada.venta.aggregate({ _sum: { total: true } }),
  ]);
  return (
    <section className="pos-shell private-dashboard">
      <header className="pos-header">
        <div>
          <h1>Panel</h1>
        </div>
      </header>
      <div className="pos-metrics">
        <div>
          <small>Medicamentos</small>
          <strong>{productos}</strong>
        </div>
        <div>
          <small>Ventas registradas</small>
          <strong>{ventas}</strong>
        </div>
        <div>
          <small>Total registrado</small>
          <strong>
            {new Intl.NumberFormat("es-CL", {
              style: "currency",
              currency: "CLP",
              maximumFractionDigits: 0,
            }).format(Number(totales._sum.total ?? 0))}
          </strong>
        </div>
        <div>
          <small>Módulos</small>
          <strong>{secciones.length}</strong>
        </div>
      </div>
      <section
        className="private-dashboard-grid"
        aria-label="Áreas de farmacia privada"
      >
        {secciones.map((s) => (
          <Link className="private-dashboard-card" href={s.ruta} key={s.ruta}>
            <span className="private-dashboard-icon">{s.icono}</span>
            <h2>{s.titulo}</h2>
            <p>{s.descripcion}</p>
            <b>
              {s.accion} <span aria-hidden="true">→</span>
            </b>
          </Link>
        ))}
      </section>
    </section>
  );
}

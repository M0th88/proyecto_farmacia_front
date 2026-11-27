import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { pharmacies } from "@/lib/auth/pharmacies";
import { resolvePharmacy } from "@/lib/auth/pharmacy-scope";
import { requirePharmacyUser } from "@/lib/auth/session";
import { pharmacyDb } from "@/lib/db/pharmacy-db";
import { roleHasPermission } from "@/lib/private/permissions";
import { mediosPago } from "@/lib/types/punto-de-venta";
import {
  camposFacturacion,
  facturacionSchema,
  fechaVenta,
  pesos,
} from "@/lib/validation/punto-de-venta";
import styles from "./_components/documento-venta.module.css";
import { ImprimirVenta } from "./_components/imprimir-venta";
import { OperacionesDeVenta } from "./_components/operaciones-de-venta";

export const instant = false;

export default async function DocumentoVentaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; farmacia: string }>;
  searchParams: Promise<{
    imprimir?: string | string[];
    cobro?: string | string[];
  }>;
}) {
  const pharmacy = await resolvePharmacy(params);
  const { rol } = await requirePharmacyUser(pharmacy);
  const puedeVerHistorial = roleHasPermission(rol, "ventas");
  const puedeUsarPos = roleHasPermission(rol, "pos");
  const [{ id }, { imprimir, cobro }] = await Promise.all([
    params,
    searchParams,
  ]);
  const numeroVenta = Number(id);
  if (!/^\d{1,10}$/.test(id) || numeroVenta < 1 || numeroVenta > 2_147_483_647)
    notFound();
  const where: { id: number; claveOperacion?: string } = { id: numeroVenta };
  if (!puedeVerHistorial) {
    const comprobantePos = z.uuid().safeParse(cobro);
    if (!puedeUsarPos || !comprobantePos.success)
      redirect(`/${pharmacy}/sin-acceso`);
    where.claveOperacion = comprobantePos.data;
  }
  const venta = await pharmacyDb(pharmacy).venta.findUnique({
    where,
    include: {
      detalles: {
        orderBy: { id: "asc" },
        include: {
          medicamento: { select: { nombre: true } },
          lote: { select: { numeroLote: true } },
        },
      },
    },
  });
  if (!venta) notFound();

  const tipo =
    venta.tipoDocumento === "FACTURA"
      ? "Factura"
      : venta.tipoDocumento === "BOLETA"
        ? "Boleta"
        : null;
  const datos = facturacionSchema.safeParse(venta.datosFacturacion);
  const facturacion =
    venta.tipoDocumento === "FACTURA" && datos.success ? datos.data : null;
  const tieneDesglose = venta.neto !== null || venta.subtotal.gt(0);
  const lineas = venta.detalles.map((detalle) => ({
    id: detalle.id,
    nombre: detalle.nombreProducto ?? detalle.medicamento.nombre,
    cantidad: detalle.cantidad,
    lote: detalle.lote.numeroLote,
    precio: Number(detalle.precioUnitario),
    subtotal: Number(detalle.subtotal),
  }));

  return (
    <section className="pos-shell">
      <header className="pos-header">
        <div>
          <h1>Venta #{venta.id}</h1>
          <p>
            {puedeVerHistorial && (
              <Link
                href={`/${pharmacy}/historial-y-reportes#operaciones-recientes`}
              >
                Volver al historial
              </Link>
            )}
            {puedeUsarPos && (
              <Link href={`/${pharmacy}/punto-de-venta`}>Ir al POS</Link>
            )}
          </p>
        </div>
        <ImprimirVenta abrirDialogo={imprimir === "1"} />
      </header>
      <article id="documento-venta" className={styles.document}>
        <header className={styles.title}>
          <div>
            <p>{pharmacies[pharmacy].name}</p>
            <h2>{tipo ? `${tipo} · Vista previa` : "Comprobante interno"}</h2>
          </div>
          <div>
            <strong>Venta #{venta.id}</strong>
            <time dateTime={venta.creadaEn.toISOString()}>
              {fechaVenta(venta.creadaEn)}
            </time>
          </div>
        </header>
        <p className={styles.notice}>
          Documento sin validez tributaria.{" "}
          {tipo
            ? "La emisión electrónica ante el SII está pendiente."
            : "Esta venta no tiene un tipo de documento registrado."}
        </p>
        {facturacion && (
          <section>
            <h3>Datos de facturación</h3>
            <dl className={styles.billing}>
              {camposFacturacion.map(
                ({ nombre, etiqueta }) =>
                  facturacion[nombre] && (
                    <div key={nombre}>
                      <dt>{etiqueta}</dt>
                      <dd>{facturacion[nombre]}</dd>
                    </div>
                  ),
              )}
            </dl>
          </section>
        )}
        <div className={styles.table}>
          <table>
            <caption>Detalle de productos</caption>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Lote</th>
                <th>Cantidad</th>
                <th>Precio unitario</th>
                <th>Importe</th>
              </tr>
            </thead>
            <tbody>
              {lineas.map((linea) => (
                <tr key={linea.id}>
                  <td>{linea.nombre}</td>
                  <td>{linea.lote}</td>
                  <td>{linea.cantidad}</td>
                  <td>{pesos(linea.precio)}</td>
                  <td>{pesos(linea.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className={styles.totals}>
          {tieneDesglose && (
            <div>
              <dt>Subtotal con IVA</dt>
              <dd>{pesos(Number(venta.subtotal))}</dd>
            </div>
          )}
          {tieneDesglose && (
            <div>
              <dt>Descuento</dt>
              <dd>−{pesos(Number(venta.descuento))}</dd>
            </div>
          )}
          {venta.neto !== null && (
            <div>
              <dt>Neto</dt>
              <dd>{pesos(Number(venta.neto))}</dd>
            </div>
          )}
          {venta.iva !== null && (
            <div>
              <dt>IVA</dt>
              <dd>{pesos(Number(venta.iva))}</dd>
            </div>
          )}
          <div className={styles.grandTotal}>
            <dt>Total pagado</dt>
            <dd>{pesos(Number(venta.total))}</dd>
          </div>
          <div>
            <dt>Medio de pago</dt>
            <dd>{mediosPago[venta.metodoPago]}</dd>
          </div>
          {venta.recibido !== null && (
            <div>
              <dt>Efectivo recibido</dt>
              <dd>{pesos(Number(venta.recibido))}</dd>
            </div>
          )}
          {venta.vuelto !== null && (
            <div>
              <dt>Vuelto</dt>
              <dd>{pesos(Number(venta.vuelto))}</dd>
            </div>
          )}
        </dl>
      </article>
      {puedeVerHistorial && <OperacionesDeVenta lineas={lineas} />}
    </section>
  );
}

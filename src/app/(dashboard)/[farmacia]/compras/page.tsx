import { connection } from "next/server";
import {
  type PharmacyParams,
  resolvePharmacy,
} from "@/lib/auth/pharmacy-scope";
import { requirePharmacyUser } from "@/lib/auth/session";
import { prismaPrivada as db } from "@/lib/db/prisma-privada";
import { canOperate } from "@/lib/fefo";
import { EmptyPrivateSection } from "../_components/empty-private-section";
import { SinPermiso } from "../_components/solo-asistencial";
import { Compras } from "./_components/compras";

export const instant = false;

export default async function ComprasPage({ params }: PharmacyParams) {
  const pharmacy = await resolvePharmacy(params);
  const user = await requirePharmacyUser(pharmacy);
  if (pharmacy !== "privada")
    return <EmptyPrivateSection params={params} title="Compras" />;
  if (!canOperate(user, "compras"))
    return <SinPermiso texto="Tu rol no puede gestionar compras." />;
  await connection();
  const [ordenes, proveedores, productos, ubicaciones] = await Promise.all([
    db.ordenCompra.findMany({
      orderBy: { id: "desc" },
      take: 100,
      include: {
        proveedor: { select: { razonSocial: true, nombreFantasia: true } },
        items: { include: { medicamento: { select: { nombre: true } } } },
      },
    }),
    db.proveedor.findMany({
      where: { activo: true },
      orderBy: { razonSocial: "asc" },
      select: { id: true, razonSocial: true, nombreFantasia: true },
    }),
    db.medicamento.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true, concentracion: true },
    }),
    db.ubicacionInventario.findMany({
      where: { sucursalId: { not: null } },
      orderBy: { nombre: "asc" },
      select: {
        id: true,
        nombre: true,
        tipo: true,
        sucursal: { select: { nombre: true } },
      },
    }),
  ]);
  return (
    <Compras
      ordenes={ordenes.map((o) => ({
        id: o.id,
        estado: o.estado,
        proveedor: o.proveedor.nombreFantasia || o.proveedor.razonSocial,
        creadaEn: o.creadaEn.toISOString().slice(0, 10),
        fechaEsperada: o.fechaEsperada?.toISOString().slice(0, 10) ?? "",
        observaciones: o.observaciones ?? "",
        items: o.items.map((i) => ({
          id: i.id,
          producto: i.medicamento.nombre,
          cantidad: i.cantidad,
          costoUnitario: Number(i.costoUnitario),
          recibida: i.recibida,
          rechazada: i.rechazada,
        })),
      }))}
      proveedores={proveedores.map((p) => ({
        id: p.id,
        nombre: p.nombreFantasia || p.razonSocial,
      }))}
      productos={productos.map((p) => ({
        id: p.id,
        nombre: p.concentracion ? `${p.nombre} · ${p.concentracion}` : p.nombre,
      }))}
      ubicaciones={ubicaciones.map((u) => ({
        id: u.id,
        nombre: `${u.nombre} (${u.tipo === "BODEGA" ? "Bodega" : "Vitrina"}) · ${u.sucursal?.nombre ?? ""}`,
      }))}
    />
  );
}

import { connection } from "next/server";
import {
  type PharmacyParams,
  resolvePharmacy,
} from "@/lib/auth/pharmacy-scope";
import { requirePharmacyUser } from "@/lib/auth/session";
import { prismaPrivada as db } from "@/lib/db/prisma-privada";
import { canOperate } from "@/lib/fefo";
import { existenciasDevolvibles } from "@/lib/private/abastecimiento";
import { EmptyPrivateSection } from "../_components/empty-private-section";
import { SinPermiso } from "../_components/solo-asistencial";
import { Devoluciones } from "./_components/devoluciones";

export const instant = false;

export default async function DevolucionesPage({ params }: PharmacyParams) {
  const pharmacy = await resolvePharmacy(params);
  const user = await requirePharmacyUser(pharmacy);
  if (pharmacy !== "privada")
    return (
      <EmptyPrivateSection params={params} title="Devoluciones a Proveedor" />
    );
  if (!canOperate(user, "compras"))
    return <SinPermiso texto="Tu rol no puede gestionar compras." />;
  await connection();
  const [devoluciones, proveedores, existencias] = await Promise.all([
    db.devolucionProveedor.findMany({
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
    existenciasDevolvibles(),
  ]);
  return (
    <Devoluciones
      devoluciones={devoluciones.map((d) => ({
        id: d.id,
        fecha: d.creadaEn.toISOString().slice(0, 10),
        proveedor: d.proveedor.nombreFantasia || d.proveedor.razonSocial,
        motivo: d.motivo,
        guia: d.guia ?? "",
        estado: d.estado,
        notaCredito: d.notaCredito ?? "",
        monto: d.montoNotaCredito ? Number(d.montoNotaCredito) : null,
        items: d.items.map((i) => ({
          id: i.id,
          producto: i.medicamento.nombre,
          cantidad: i.cantidad,
        })),
      }))}
      proveedores={proveedores.map((p) => ({
        id: p.id,
        nombre: p.nombreFantasia || p.razonSocial,
      }))}
      existencias={existencias}
    />
  );
}

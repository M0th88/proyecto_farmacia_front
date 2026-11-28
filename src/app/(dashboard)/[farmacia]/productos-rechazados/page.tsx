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
import { Rechazados } from "./_components/rechazados";

export const instant = false;

export default async function ProductosRechazadosPage({
  params,
}: PharmacyParams) {
  const pharmacy = await resolvePharmacy(params);
  const user = await requirePharmacyUser(pharmacy);
  if (pharmacy !== "privada")
    return <EmptyPrivateSection params={params} title="Productos Rechazados" />;
  if (!canOperate(user, "compras"))
    return <SinPermiso texto="Tu rol no puede gestionar compras." />;
  await connection();
  const rechazos = await db.productoRechazado.findMany({
    orderBy: [{ estado: "desc" }, { id: "desc" }],
    take: 300,
    include: {
      proveedor: {
        select: { id: true, razonSocial: true, nombreFantasia: true },
      },
      medicamento: { select: { nombre: true } },
    },
  });
  return (
    <Rechazados
      rechazos={rechazos.map((r) => ({
        id: r.id,
        fecha: r.creadoEn.toISOString().slice(0, 10),
        ordenId: r.ordenId,
        proveedorId: r.proveedor.id,
        proveedor: r.proveedor.nombreFantasia || r.proveedor.razonSocial,
        producto: r.medicamento.nombre,
        lote: r.numeroLote ?? "",
        cantidad: r.cantidad,
        motivo: r.motivo,
        detalle: r.detalle ?? "",
        estado: r.estado,
        devolucionId: r.devolucionId,
      }))}
    />
  );
}

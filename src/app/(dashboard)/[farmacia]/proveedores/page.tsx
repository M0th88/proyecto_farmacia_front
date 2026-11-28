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
import { Proveedores } from "./_components/proveedores";

export const instant = false;

export default async function ProveedoresPage({ params }: PharmacyParams) {
  const pharmacy = await resolvePharmacy(params);
  const user = await requirePharmacyUser(pharmacy);
  if (pharmacy !== "privada")
    return <EmptyPrivateSection params={params} title="Proveedores" />;
  if (!canOperate(user, "proveedores"))
    return <SinPermiso texto="Tu rol no puede ver proveedores." />;
  await connection();
  const proveedores = await db.proveedor.findMany({
    orderBy: [{ activo: "desc" }, { razonSocial: "asc" }],
    include: {
      _count: {
        select: {
          ordenes: true,
          rechazos: { where: { estado: "PENDIENTE" } },
        },
      },
    },
  });
  return (
    <Proveedores
      proveedores={proveedores.map((p) => ({
        id: p.id,
        rut: p.rut,
        razonSocial: p.razonSocial,
        nombreFantasia: p.nombreFantasia ?? "",
        contacto: p.contacto ?? "",
        telefono: p.telefono ?? "",
        email: p.email ?? "",
        direccion: p.direccion ?? "",
        activo: p.activo,
        ordenes: p._count.ordenes,
        rechazosPendientes: p._count.rechazos,
      }))}
    />
  );
}

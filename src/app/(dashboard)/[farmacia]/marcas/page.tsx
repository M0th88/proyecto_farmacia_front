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
import { Marcas } from "./_components/marcas";

export const instant = false;

export default async function MarcasPage({ params }: PharmacyParams) {
  const pharmacy = await resolvePharmacy(params);
  const user = await requirePharmacyUser(pharmacy);
  if (pharmacy !== "privada")
    return <EmptyPrivateSection params={params} title="Marcas" />;
  if (!canOperate(user, "catalogo"))
    return <SinPermiso texto="Tu rol no puede administrar el catálogo." />;
  await connection();
  const [marcas, productos] = await Promise.all([
    db.marca.findMany({
      orderBy: [{ activo: "desc" }, { nombre: "asc" }],
      include: { _count: { select: { medicamentos: true } } },
    }),
    db.medicamento.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
      select: {
        id: true,
        nombre: true,
        concentracion: true,
        principioActivo: true,
        marcaId: true,
      },
    }),
  ]);
  return (
    <Marcas
      marcas={marcas.map((m) => ({
        id: m.id,
        nombre: m.nombre,
        laboratorio: m.laboratorio ?? "",
        pais: m.pais ?? "",
        activo: m.activo,
        productos: m._count.medicamentos,
      }))}
      productos={productos.map((p) => ({
        id: p.id,
        nombre: p.concentracion ? `${p.nombre} · ${p.concentracion}` : p.nombre,
        principioActivo: p.principioActivo ?? "",
        marcaId: p.marcaId,
      }))}
    />
  );
}

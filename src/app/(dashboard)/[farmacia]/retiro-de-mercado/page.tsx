import { connection } from "next/server";
import {
  type PharmacyParams,
  resolvePharmacy,
} from "@/lib/auth/pharmacy-scope";
import { requirePharmacyUser } from "@/lib/auth/session";
import { prismaPrivada as db } from "@/lib/db/prisma-privada";
import { canOperate } from "@/lib/fefo";
import { alertasRetiro } from "@/lib/private/abastecimiento";
import { EmptyPrivateSection } from "../_components/empty-private-section";
import { SinPermiso } from "../_components/solo-asistencial";
import { RetiroMercado } from "./_components/retiro-mercado";

export const instant = false;

export default async function RetiroDeMercadoPage({ params }: PharmacyParams) {
  const pharmacy = await resolvePharmacy(params);
  const user = await requirePharmacyUser(pharmacy);
  if (pharmacy !== "privada")
    return <EmptyPrivateSection params={params} title="Retiro de Mercado" />;
  if (!canOperate(user, "inventario"))
    return <SinPermiso texto="Tu rol no tiene acceso al inventario." />;
  await connection();
  const [alertas, productos] = await Promise.all([
    alertasRetiro(),
    db.medicamento.findMany({
      where: { lotes: { some: {} } },
      orderBy: { nombre: "asc" },
      select: {
        id: true,
        nombre: true,
        concentracion: true,
        lotes: {
          orderBy: { fechaVencimiento: "asc" },
          select: { numeroLote: true, estado: true },
        },
      },
    }),
  ]);
  return (
    <RetiroMercado
      alertas={alertas}
      productos={productos.map((p) => ({
        id: p.id,
        nombre: p.concentracion ? `${p.nombre} · ${p.concentracion}` : p.nombre,
        lotes: p.lotes.map((l) => ({
          numero: l.numeroLote,
          retirado: l.estado === "RETIRADO_ALERTA",
        })),
      }))}
    />
  );
}

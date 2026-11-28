import { connection } from "next/server";
import {
  type PharmacyParams,
  resolvePharmacy,
} from "@/lib/auth/pharmacy-scope";
import { requirePharmacyUser } from "@/lib/auth/session";
import { prismaAsistencial as db } from "@/lib/db/prisma-asistencial";
import { canOperate } from "@/lib/fefo";
import { SinPermiso, SoloAsistencial } from "../_components/solo-asistencial";
import { Pacientes } from "./_components/pacientes";

export const instant = false;

export default async function PacientesPage({
  params,
  searchParams,
}: PharmacyParams & { searchParams: Promise<{ q?: string }> }) {
  const pharmacy = await resolvePharmacy(params);
  const user = await requirePharmacyUser(pharmacy);
  if (pharmacy !== "asistencial") return <SoloAsistencial titulo="Pacientes" />;
  if (!canOperate(user, "pos"))
    return <SinPermiso texto="Tu rol no puede ver pacientes." />;
  await connection();
  const q = ((await searchParams).q ?? "").trim().slice(0, 60);
  const [pacientes, programas] = await Promise.all([
    db.paciente.findMany({
      where: q
        ? {
            OR: [
              { rut: { contains: q, mode: "insensitive" } },
              { nombre: { contains: q, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { nombre: "asc" },
      take: 200,
      include: {
        inscripciones: {
          include: { programa: { select: { id: true, nombre: true } } },
        },
        _count: { select: { dispensaciones: true } },
      },
    }),
    db.programaSalud.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true },
    }),
  ]);
  return (
    <Pacientes
      busqueda={q}
      programas={programas}
      pacientes={pacientes.map((p) => ({
        id: p.id,
        rut: p.rut,
        nombre: p.nombre,
        entregas: p._count.dispensaciones,
        inscripciones: p.inscripciones.map((i) => ({
          programaId: i.programa.id,
          programa: i.programa.nombre,
          activo: i.activo,
        })),
      }))}
    />
  );
}

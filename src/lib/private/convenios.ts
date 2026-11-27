import "server-only";
import type { Prisma } from "@/generated/privada/client";
import { prismaPrivada } from "@/lib/db/prisma-privada";

type Db = Prisma.TransactionClient | typeof prismaPrivada;

export type ConvenioCliente = {
  rut: string;
  nombre: string;
  convenio: { id: number; nombre: string; tipo: string; porcentaje: number };
};

/** Cliente con convenio activo, o null si no tiene. */
export async function convenioDeCliente(
  rut: string,
  db: Db = prismaPrivada,
): Promise<ConvenioCliente | null> {
  const cliente = await db.clienteConvenio.findUnique({
    where: { rut: rut.trim().toUpperCase() },
    include: { convenio: true },
  });
  if (!cliente?.convenio.activo) return null;
  return {
    rut: cliente.rut,
    nombre: cliente.nombre,
    convenio: {
      id: cliente.convenio.id,
      nombre: cliente.convenio.nombre,
      tipo: cliente.convenio.tipo,
      porcentaje: Number(cliente.convenio.porcentaje),
    },
  };
}

export async function listarConvenios() {
  const [convenios, clientes] = await Promise.all([
    prismaPrivada.convenioDescuento.findMany({
      orderBy: [{ activo: "desc" }, { nombre: "asc" }],
      include: { _count: { select: { clientes: true } } },
    }),
    prismaPrivada.clienteConvenio.findMany({
      orderBy: { id: "desc" },
      take: 500,
      include: { convenio: { select: { nombre: true, activo: true } } },
    }),
  ]);
  return {
    convenios: convenios.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      tipo: c.tipo,
      porcentaje: Number(c.porcentaje),
      activo: c.activo,
      afiliados: c._count.clientes,
    })),
    clientes: clientes.map((c) => ({
      id: c.id,
      rut: c.rut,
      nombre: c.nombre,
      convenioId: c.convenioId,
      convenio: c.convenio.nombre,
      convenioActivo: c.convenio.activo,
    })),
  };
}
export type ListadoConvenios = Awaited<ReturnType<typeof listarConvenios>>;

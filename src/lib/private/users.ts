import "server-only";
import { rankItem } from "@tanstack/match-sorter-utils";
import { z } from "zod";
import type { Prisma } from "@/generated/privada/client";
import { prismaPrivada } from "@/lib/db/prisma-privada";
import type { PaginationResponse } from "@/lib/types/pagination";
import type { User } from "@/lib/types/usuarios-y-roles";

export const userSelect = {
  id: true,
  rut: true,
  nombre: true,
  apellido: true,
  telefono: true,
  email: true,
  activo: true,
  rolId: true,
  rol: { select: { nombre: true } },
  creadoEn: true,
  actualizadoEn: true,
} satisfies Prisma.UsuarioSelect;
type UserRecord = Prisma.UsuarioGetPayload<{ select: typeof userSelect }>;
export const serializeUser = (user: UserRecord): User => ({
  ...user,
  creadoEn: user.creadoEn.toISOString(),
  actualizadoEn: user.actualizadoEn.toISOString(),
});

const sortable = z.enum([
  "id",
  "nombre",
  "apellido",
  "rut",
  "email",
  "telefono",
  "rol",
  "activo",
  "creadoEn",
  "actualizadoEn",
]);
export const userListSchema = z.object({
  page: z.coerce.number().int().min(0).max(100000).default(0),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
  search: z.string().trim().max(254).default(""),
  sort: sortable.default("nombre"),
  direction: z.enum(["asc", "desc"]).default("asc"),
});
export type UserListOptions = z.infer<typeof userListSchema>;
export async function listUsersPage(
  options: UserListOptions,
): Promise<PaginationResponse<User>> {
  const { page, pageSize, search, sort, direction } = options;
  const orderBy: Prisma.UsuarioOrderByWithRelationInput[] = [
    sort === "rol" ? { rol: { nombre: direction } } : { [sort]: direction },
  ];
  if (sort !== "id") orderBy.push({ id: "asc" });
  let users: UserRecord[];
  let totalRows: number;
  if (search) {
    const normalize = (value: string) =>
      value
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .toLowerCase()
        .replace(/[.\-]/g, "");
    const all = await prismaPrivada.usuario.findMany({
      select: userSelect,
      orderBy,
    });
    const matched = all.filter(
      (user) =>
        rankItem(
          normalize(
            [
              user.id,
              user.nombre,
              user.apellido,
              user.rut,
              user.email,
              user.telefono,
              user.rol.nombre,
              user.activo ? "Activo" : "Inactivo",
            ].join(" "),
          ),
          normalize(search),
        ).passed,
    );
    totalRows = matched.length;
    users = matched.slice(page * pageSize, (page + 1) * pageSize);
  } else {
    [users, totalRows] = await prismaPrivada.$transaction([
      prismaPrivada.usuario.findMany({
        select: userSelect,
        orderBy,
        skip: page * pageSize,
        take: pageSize,
      }),
      prismaPrivada.usuario.count(),
    ]);
  }
  return {
    data: users.map(serializeUser),
    totalRows,
    nextPage: (page + 1) * pageSize < totalRows ? page + 1 : null,
  };
}

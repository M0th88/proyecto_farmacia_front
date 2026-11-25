import { z } from "zod";
import { pharmacyRoute } from "@/lib/auth/pharmacy-route";
import { noAdmin, pharmacyAdmin } from "@/lib/private/admin";
import {
  ALL_PRIVATE_PERMISSIONS,
  PRIVATE_SECTIONS,
} from "@/lib/private/permissions";

const permiso = z.enum(ALL_PRIVATE_PERMISSIONS);
const entrada = z.object({
  nombre: z.string().trim().min(2, "Debe ingresar un nombre").max(60),
  descripcion: z
    .string()
    .max(500)
    .trim()
    .min(1, "Debe ingresar una descripción"),
  permisos: z.array(permiso).min(1),
});
const restricted = (permissions: string[]) =>
  permissions.some((p) => p === "usuarios" || p === "roles");
const roleSelect = {
  id: true,
  nombre: true,
  descripcion: true,
  permisos: true,
  _count: { select: { usuarios: true } },
} as const;

export const GET = pharmacyRoute(async (request, pharmacy, db) => {
  if (!(await pharmacyAdmin(pharmacy))) return noAdmin();
  const roles = await db.rol.findMany({
    orderBy: { nombre: "asc" },
    select: {
      id: true,
      nombre: true,
      descripcion: true,
      permisos: true,
      _count: { select: { usuarios: true } },
    },
  });
  const params = new URL(request.url).searchParams;
  if (!params.has("page")) return Response.json(roles);
  const parsed = z
    .object({
      page: z.coerce.number().int().min(0),
      pageSize: z.coerce.number().int().min(1).max(100),
      search: z.string().max(200),
      sort: z.enum(["id", "nombre", "descripcion", "permisos", "usuarios"]),
      direction: z.enum(["asc", "desc"]),
    })
    .safeParse({
      page: params.get("page"),
      pageSize: params.get("pageSize") ?? 30,
      search: params.get("search") ?? "",
      sort: params.get("sort") ?? "nombre",
      direction: params.get("direction") ?? "asc",
    });
  if (!parsed.success)
    return Response.json({ error: "Filtros inválidos." }, { status: 400 });
  const { page, pageSize, search, sort, direction } = parsed.data;
  const labels = (permissions: string[]) =>
    PRIVATE_SECTIONS.filter((s) => permissions.includes(s.key))
      .map((s) => s.label)
      .join(", ");
  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("es");
  const filtered = roles.filter((role) =>
    normalize(
      `${role.nombre} ${role.descripcion ?? ""} ${labels(role.permisos)}`,
    ).includes(normalize(search.trim())),
  );
  const value = (role: (typeof roles)[number]) =>
    sort === "usuarios"
      ? role._count.usuarios
      : sort === "permisos"
        ? labels(role.permisos)
        : (role[sort] ?? "");
  filtered.sort((a, b) => {
    const x = value(a),
      y = value(b);
    const comparison =
      typeof x === "number" && typeof y === "number"
        ? x - y
        : String(x).localeCompare(String(y), "es", { numeric: true });
    return (direction === "desc" ? -comparison : comparison) || a.id - b.id;
  });
  const start = page * pageSize;
  return Response.json({
    data: filtered.slice(start, start + pageSize),
    totalRows: filtered.length,
    nextPage: start + pageSize < filtered.length ? page + 1 : null,
  });
});
export const POST = pharmacyRoute(async (request, pharmacy, db) => {
  if (!(await pharmacyAdmin(pharmacy))) return noAdmin();
  const parsed = entrada.safeParse(await request.json().catch(() => null));
  if (
    !parsed.success ||
    restricted(parsed.data.permisos) ||
    parsed.data.nombre === "Administrador"
  )
    return Response.json(
      {
        error:
          "Nombre o permisos inválidos. La gestión de usuarios queda reservada al administrador.",
      },
      { status: 400 },
    );
  try {
    return Response.json(
      await db.rol.create({
        data: { ...parsed.data, permisos: [...new Set(parsed.data.permisos)] },
        select: roleSelect,
      }),
      { status: 201 },
    );
  } catch {
    return Response.json(
      { error: "No se pudo crear el rol. Comprueba que el nombre sea único." },
      { status: 409 },
    );
  }
});
export const PATCH = pharmacyRoute(async (request, pharmacy, db) => {
  if (!(await pharmacyAdmin(pharmacy))) return noAdmin();
  const parsed = z
    .object({
      id: z.number().int().positive(),
      nombre: entrada.shape.nombre.optional(),
      descripcion: entrada.shape.descripcion.optional(),
      permisos: z.array(permiso).min(1),
    })
    .safeParse(await request.json().catch(() => null));
  if (
    !parsed.success ||
    restricted(parsed.data.permisos) ||
    parsed.data.nombre === "Administrador"
  )
    return Response.json({ error: "Permisos inválidos." }, { status: 400 });
  const role = await db.rol.findUnique({
    where: { id: parsed.data.id },
  });
  if (!role || role.nombre === "Administrador")
    return Response.json(
      { error: "Este rol no se puede modificar." },
      { status: 400 },
    );
  try {
    return Response.json(
      await db.rol.update({
        where: { id: role.id },
        data: {
          nombre: parsed.data.nombre,
          descripcion: parsed.data.descripcion,
          permisos: [...new Set(parsed.data.permisos)],
        },
        select: roleSelect,
      }),
    );
  } catch {
    return Response.json(
      {
        error:
          "No se pudo actualizar el rol. Comprueba que el nombre sea único.",
      },
      { status: 409 },
    );
  }
});

export const DELETE = pharmacyRoute(async (request, pharmacy, db) => {
  if (!(await pharmacyAdmin(pharmacy))) return noAdmin();
  const parsed = z
    .object({ id: z.number().int().positive() })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json(
      { error: "Selecciona un rol válido." },
      { status: 400 },
    );
  try {
    const role = await db.rol.findUnique({
      where: { id: parsed.data.id },
      select: roleSelect,
    });
    if (!role)
      return Response.json({ error: "El rol ya no existe." }, { status: 404 });
    if (role.nombre === "Administrador" || role._count.usuarios > 0)
      return Response.json(
        {
          error:
            "No se puede eliminar el rol Administrador ni un rol con usuarios asignados.",
        },
        { status: 409 },
      );
    await db.rol.delete({ where: { id: role.id } });
    return Response.json({ success: true });
  } catch {
    return Response.json(
      {
        error:
          "No se pudo eliminar el rol. Comprueba que no tenga usuarios asignados.",
      },
      { status: 409 },
    );
  }
});

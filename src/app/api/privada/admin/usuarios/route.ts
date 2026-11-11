import bcrypt from "bcrypt";
import { z } from "zod";
import { prismaPrivada } from "@/lib/db/prisma-privada";
import { noAdmin, privateAdmin } from "@/lib/private/admin";
import {
  listUsersPage,
  serializeUser,
  userListSchema,
  userSelect,
} from "@/lib/private/users";
import { userProfileSchema } from "@/lib/types/usuarios-y-roles";

const createSchema = userProfileSchema.extend({
  apellido: userProfileSchema.shape.apellido.default(""),
  telefono: userProfileSchema.shape.telefono.default(""),
  activo: userProfileSchema.shape.activo.default(true),
  password: userProfileSchema.shape.password.refine(
    (value) => value.length >= 12,
  ),
});
const updateSchema = userProfileSchema
  .partial()
  .extend({ id: z.number().int().positive() })
  .refine((data) => Object.keys(data).some((key) => key !== "id"));

export async function GET(request: Request) {
  if (!(await privateAdmin())) return noAdmin();
  const params = new URL(request.url).searchParams;
  try {
    // El panel original sigue recibiendo el array completo sin parámetros.
    if (!params.has("page"))
      return Response.json(
        (
          await prismaPrivada.usuario.findMany({
            orderBy: [{ nombre: "asc" }, { id: "asc" }],
            select: userSelect,
          })
        ).map(serializeUser),
        { headers: { "Cache-Control": "no-store" } },
      );
    const parsed = userListSchema.safeParse(Object.fromEntries(params));
    if (!parsed.success)
      return Response.json(
        { error: "Parámetros de búsqueda inválidos." },
        { status: 400 },
      );
    return Response.json(await listUsersPage(parsed.data), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      { error: "No se pudieron cargar los usuarios." },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  if (!(await privateAdmin())) return noAdmin();
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json(
      {
        error:
          "Completa los datos y usa una contraseña de al menos 12 caracteres (máximo 72 bytes).",
      },
      { status: 400 },
    );
  const { password, ...profile } = parsed.data;
  if (!(await prismaPrivada.rol.findUnique({ where: { id: profile.rolId } })))
    return Response.json({ error: "El rol no existe." }, { status: 400 });
  try {
    const created = await prismaPrivada.usuario.create({
      data: {
        ...profile,
        apellido: profile.apellido || null,
        telefono: profile.telefono || null,
        email: profile.email.toLowerCase(),
        password: await bcrypt.hash(password, 12),
      },
      select: userSelect,
    });
    return Response.json(serializeUser(created), { status: 201 });
  } catch {
    return Response.json(
      { error: "No se pudo crear el perfil. Comprueba RUT y correo únicos." },
      { status: 409 },
    );
  }
}

export async function PATCH(request: Request) {
  const admin = await privateAdmin();
  if (!admin) return noAdmin();
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json(
      { error: "Datos del usuario inválidos." },
      { status: 400 },
    );
  const { id, password, ...profile } = parsed.data;
  const target = await prismaPrivada.usuario.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!target)
    return Response.json({ error: "Perfil no encontrado." }, { status: 404 });
  if (
    id === admin.id &&
    (profile.activo === false ||
      (profile.rolId !== undefined && profile.rolId !== admin.rolId))
  )
    return Response.json(
      { error: "No puedes desactivar o quitar tu propio rol administrador." },
      { status: 400 },
    );
  if (
    profile.rolId !== undefined &&
    !(await prismaPrivada.rol.findUnique({ where: { id: profile.rolId } }))
  )
    return Response.json({ error: "El rol no existe." }, { status: 400 });
  try {
    const updated = await prismaPrivada.usuario.update({
      where: { id },
      select: userSelect,
      data: {
        ...profile,
        ...(profile.email !== undefined
          ? { email: profile.email.toLowerCase() }
          : {}),
        ...(profile.apellido !== undefined
          ? { apellido: profile.apellido || null }
          : {}),
        ...(profile.telefono !== undefined
          ? { telefono: profile.telefono || null }
          : {}),
        ...(password ? { password: await bcrypt.hash(password, 12) } : {}),
      },
    });
    return Response.json(serializeUser(updated));
  } catch {
    return Response.json(
      {
        error:
          "No se pudo actualizar el perfil. Comprueba RUT y correo únicos.",
      },
      { status: 409 },
    );
  }
}

export async function DELETE(request: Request) {
  const admin = await privateAdmin();
  if (!admin) return noAdmin();
  const parsed = z
    .object({ id: z.number().int().positive() })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json({ error: "Usuario inválido." }, { status: 400 });
  if (parsed.data.id === admin.id)
    return Response.json(
      { error: "No puedes eliminar tu propia cuenta." },
      { status: 400 },
    );
  const target = await prismaPrivada.usuario.findUnique({
    where: { id: parsed.data.id },
    select: { id: true },
  });
  if (!target)
    return Response.json({ error: "Perfil no encontrado." }, { status: 404 });
  try {
    await prismaPrivada.usuario.delete({ where: { id: target.id } });
    return Response.json({ success: true });
  } catch {
    return Response.json(
      {
        error:
          "No se puede eliminar este usuario porque tiene registros relacionados.",
      },
      { status: 409 },
    );
  }
}

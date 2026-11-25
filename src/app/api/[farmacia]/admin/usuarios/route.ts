import bcrypt from "bcrypt";
import { z } from "zod";
import {
  changedIdentity,
  identityExistsInOtherPharmacy,
  isReservedIdentity,
} from "@/lib/auth/identity";
import { pharmacyRoute } from "@/lib/auth/pharmacy-route";
import { noAdmin, pharmacyAdmin } from "@/lib/private/admin";
import {
  listUsersPage,
  serializeUser,
  userListSchema,
  userSelect,
} from "@/lib/private/users";
import {
  userCreateProfileSchema,
  userProfileSchema,
} from "@/lib/types/usuarios-y-roles";

const createSchema = userCreateProfileSchema.extend({
  apellido: userProfileSchema.shape.apellido.default(""),
  telefono: userProfileSchema.shape.telefono.default(""),
  activo: userProfileSchema.shape.activo.default(true),
});
const updateSchema = userProfileSchema
  .partial()
  .extend({ id: z.number().int().positive() })
  .refine((data) => Object.keys(data).some((key) => key !== "id"));

export const GET = pharmacyRoute(async (request, pharmacy, db) => {
  if (!(await pharmacyAdmin(pharmacy))) return noAdmin();
  const params = new URL(request.url).searchParams;
  try {
    // El panel original sigue recibiendo el array completo sin parámetros.
    if (!params.has("page"))
      return Response.json(
        (
          await db.usuario.findMany({
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
    return Response.json(await listUsersPage(parsed.data, db), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      { error: "No se pudieron cargar los usuarios." },
      { status: 503 },
    );
  }
});

export const POST = pharmacyRoute(async (request, pharmacy, db) => {
  if (!(await pharmacyAdmin(pharmacy))) return noAdmin();
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json(
      {
        error:
          parsed.error.issues[0]?.message ?? "Revisa los datos del usuario.",
      },
      { status: 400 },
    );
  const { password, ...profile } = parsed.data;
  if (!(await db.rol.findUnique({ where: { id: profile.rolId } })))
    return Response.json({ error: "El rol no existe." }, { status: 400 });
  try {
    if (
      isReservedIdentity(profile) ||
      (await identityExistsInOtherPharmacy(pharmacy, profile))
    )
      return Response.json(
        { error: "El correo o RUT pertenece a otra cuenta o farmacia." },
        { status: 409 },
      );
    const created = await db.usuario.create({
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
});

export const PATCH = pharmacyRoute(async (request, pharmacy, db) => {
  const admin = await pharmacyAdmin(pharmacy);
  if (!admin) return noAdmin();
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json(
      {
        error:
          parsed.error.issues[0]?.message ?? "Datos del usuario inválidos.",
      },
      { status: 400 },
    );
  const { id, password, ...profile } = parsed.data;
  const target = await db.usuario.findUnique({
    where: { id },
    select: { id: true, email: true, rut: true },
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
    !(await db.rol.findUnique({ where: { id: profile.rolId } }))
  )
    return Response.json({ error: "El rol no existe." }, { status: 400 });
  try {
    const identity = changedIdentity(target, profile);
    if (
      isReservedIdentity(target) &&
      (id !== admin.id || identity.email || identity.rut)
    )
      return Response.json(
        {
          error:
            "La identidad de la cuenta superadministradora está protegida.",
        },
        { status: 403 },
      );
    if (
      isReservedIdentity(identity) ||
      (await identityExistsInOtherPharmacy(pharmacy, identity))
    )
      return Response.json(
        { error: "El correo o RUT pertenece a otra cuenta o farmacia." },
        { status: 409 },
      );
    const updated = await db.usuario.update({
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
});

export const DELETE = pharmacyRoute(async (request, pharmacy, db) => {
  const admin = await pharmacyAdmin(pharmacy);
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
  const target = await db.usuario.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, email: true, rut: true },
  });
  if (!target)
    return Response.json({ error: "Perfil no encontrado." }, { status: 404 });
  if (isReservedIdentity(target))
    return Response.json(
      {
        error: "La identidad de la cuenta superadministradora está protegida.",
      },
      { status: 403 },
    );
  try {
    await db.usuario.delete({ where: { id: target.id } });
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
});

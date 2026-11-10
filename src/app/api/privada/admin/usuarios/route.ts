import bcrypt from "bcrypt";
import { z } from "zod";
import { prismaPrivada } from "@/config/prismaPrivada";
import { noAdmin, privateAdmin } from "@/lib/private-admin";

const entrada = z.object({ rut: z.string().trim().min(6).max(20), nombre: z.string().trim().min(2).max(80), apellido: z.string().trim().max(80).optional(), email: z.email().max(254), password: z.string().min(12).max(200), rolId: z.number().int().positive() });
export async function GET() {
  if (!await privateAdmin()) return noAdmin();
  return Response.json(await prismaPrivada.usuario.findMany({ orderBy: { nombre: "asc" }, select: { id: true, rut: true, nombre: true, apellido: true, email: true, activo: true, rolId: true, rol: { select: { nombre: true } } } }));
}
export async function POST(request: Request) {
  if (!await privateAdmin()) return noAdmin();
  const parsed = entrada.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Completa el perfil y usa una contraseña de al menos 12 caracteres." }, { status: 400 });
  const role = await prismaPrivada.rol.findUnique({ where: { id: parsed.data.rolId } });
  if (!role) return Response.json({ error: "El rol no existe." }, { status: 400 });
  try {
    const { password, ...rest } = parsed.data;
    const creado = await prismaPrivada.usuario.create({ data: { ...rest, email: rest.email.trim().toLowerCase(), password: await bcrypt.hash(password, 12) }, select: { id: true, nombre: true, email: true, rolId: true, activo: true } });
    return Response.json(creado, { status: 201 });
  } catch { return Response.json({ error: "No se pudo crear el perfil. Comprueba RUT y correo únicos." }, { status: 409 }); }
}
export async function PATCH(request: Request) {
  const admin = await privateAdmin();
  if (!admin) return noAdmin();
  const parsed = z.object({ id: z.number().int().positive(), activo: z.boolean().optional(), rolId: z.number().int().positive().optional() }).refine(v => v.activo !== undefined || v.rolId !== undefined).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Cambio inválido." }, { status: 400 });
  const target = await prismaPrivada.usuario.findUnique({ where: { id: parsed.data.id } });
  if (!target) return Response.json({ error: "Perfil no encontrado." }, { status: 404 });
  if (target.id === admin.id && (parsed.data.activo === false || (parsed.data.rolId !== undefined && parsed.data.rolId !== admin.rolId))) return Response.json({ error: "No puedes desactivar o quitar tu propio rol administrador." }, { status: 400 });
  if (parsed.data.rolId !== undefined && !await prismaPrivada.rol.findUnique({ where: { id: parsed.data.rolId } })) return Response.json({ error: "El rol no existe." }, { status: 400 });
  return Response.json(await prismaPrivada.usuario.update({ where: { id: target.id }, data: { activo: parsed.data.activo, rolId: parsed.data.rolId }, select: { id: true, activo: true, rolId: true } }));
}

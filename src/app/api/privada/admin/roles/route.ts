import { z } from "zod";
import { prismaPrivada } from "@/config/prismaPrivada";
import { ALL_PRIVATE_PERMISSIONS } from "@/lib/private-permissions";
import { noAdmin, privateAdmin } from "@/lib/private-admin";

const permiso = z.enum(ALL_PRIVATE_PERMISSIONS);
const entrada = z.object({
  nombre: z.string().trim().min(2).max(60),
  descripcion: z.string().trim().max(200).optional(),
  permisos: z.array(permiso).min(1),
});
export async function GET() {
  if (!(await privateAdmin())) return noAdmin();
  return Response.json(
    await prismaPrivada.rol.findMany({
      orderBy: { nombre: "asc" },
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        permisos: true,
        _count: { select: { usuarios: true } },
      },
    }),
  );
}
export async function POST(request: Request) {
  if (!(await privateAdmin())) return noAdmin();
  const parsed = entrada.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.permisos.includes("usuarios"))
    return Response.json(
      {
        error:
          "Nombre o permisos inválidos. La gestión de usuarios queda reservada al administrador.",
      },
      { status: 400 },
    );
  try {
    return Response.json(
      await prismaPrivada.rol.create({
        data: { ...parsed.data, permisos: [...new Set(parsed.data.permisos)] },
        select: { id: true, nombre: true, descripcion: true, permisos: true },
      }),
      { status: 201 },
    );
  } catch {
    return Response.json(
      { error: "No se pudo crear el rol. Comprueba que el nombre sea único." },
      { status: 409 },
    );
  }
}
export async function PATCH(request: Request) {
  if (!(await privateAdmin())) return noAdmin();
  const parsed = z
    .object({
      id: z.number().int().positive(),
      permisos: z.array(permiso).min(1),
    })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.permisos.includes("usuarios"))
    return Response.json({ error: "Permisos inválidos." }, { status: 400 });
  const role = await prismaPrivada.rol.findUnique({
    where: { id: parsed.data.id },
  });
  if (!role || role.nombre === "Administrador")
    return Response.json(
      { error: "Este rol no se puede modificar." },
      { status: 400 },
    );
  return Response.json(
    await prismaPrivada.rol.update({
      where: { id: role.id },
      data: { permisos: [...new Set(parsed.data.permisos)] },
      select: { id: true, nombre: true, permisos: true },
    }),
  );
}

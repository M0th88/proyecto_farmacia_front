import { currentPrivateUser } from "@/lib/private-auth";

export async function privateAdmin() {
  const user = await currentPrivateUser();
  return user?.rol.nombre === "Administrador" ? user : null;
}
export const noAdmin = () => Response.json({ error: "Acceso exclusivo del administrador." }, { status: 403 });

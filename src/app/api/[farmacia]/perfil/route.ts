import bcrypt from "bcrypt";
import {
  changedIdentity,
  identityExistsInOtherPharmacy,
  isReservedIdentity,
} from "@/lib/auth/identity";
import { pharmacyRoute } from "@/lib/auth/pharmacy-route";
import { getPharmacyUser } from "@/lib/auth/session";
import { serializeUser, userSelect } from "@/lib/private/users";
import { ownProfileSchema } from "@/lib/types/usuarios-y-roles";

export const PATCH = pharmacyRoute(async (request, pharmacy, db) => {
  const user = await getPharmacyUser(pharmacy);
  if (!user)
    return Response.json({ error: "Debes iniciar sesión." }, { status: 401 });
  const parsed = ownProfileSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return Response.json(
      {
        error:
          parsed.error.issues[0]?.message ??
          "Revisa tus datos. No puedes modificar roles ni cuentas ajenas desde Configuración.",
      },
      { status: 400 },
    );
  const { password, ...profile } = parsed.data;
  try {
    const identity = changedIdentity(user, profile);
    if (isReservedIdentity(user) && (identity.email || identity.rut))
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
      where: { id: user.id },
      select: userSelect,
      data: {
        ...profile,
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
          "No se pudieron guardar tus datos. Comprueba que el RUT y el correo no estén usados por otra cuenta.",
      },
      { status: 409 },
    );
  }
});

import { redirect } from "next/navigation";
import { Suspense } from "react";
import {
  type PharmacyParams,
  resolvePharmacy,
} from "@/lib/auth/pharmacy-scope";
import { requirePharmacyUser } from "@/lib/auth/session";
import { pharmacyDb } from "@/lib/db/pharmacy-db";
import { GRUPOS_PERMISOS } from "@/lib/private/permisos-grupos";
import { RolesTable } from "./_components/roles-table";
import RolesLoading from "./loading";

export const instant = false;

async function RolesContent({ params }: PharmacyParams) {
  const pharmacy = await resolvePharmacy(params);
  const user = await requirePharmacyUser(pharmacy);
  if (user.rol.nombre !== "Administrador") redirect(`/${pharmacy}/sin-acceso`);
  const roles = await pharmacyDb(pharmacy).rol.findMany({
    select: {
      nombre: true,
      permisos: true,
      _count: { select: { usuarios: true } },
    },
  });
  const sensibles = new Set(
    GRUPOS_PERMISOS.flatMap((g) => g.permisos)
      .filter((p) => p.sensible)
      .map((p) => p.key),
  );
  return (
    <RolesTable
      currentUserId={user.id}
      resumen={{
        roles: roles.length,
        usuarios: roles.reduce((n, r) => n + r._count.usuarios, 0),
        sinUsuarios: roles.filter((r) => r._count.usuarios === 0).length,
        conSensibles: roles.filter(
          (r) =>
            r.nombre !== "Administrador" &&
            r.permisos.some((p) => sensibles.has(p)),
        ).length,
      }}
    />
  );
}

export default function RolesPage({ params }: PharmacyParams) {
  return (
    <Suspense fallback={<RolesLoading />}>
      <RolesContent params={params} />
    </Suspense>
  );
}

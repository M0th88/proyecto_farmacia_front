import { Suspense } from "react";
import { PharmacyProvider } from "@/components/pharmacy-provider";
import { isSuperAdmin } from "@/lib/auth/identity";
import {
  type PharmacyParams,
  resolvePharmacy,
} from "@/lib/auth/pharmacy-scope";
import { requirePharmacyUser } from "@/lib/auth/session";
import { rolePermissions } from "@/lib/private/permissions";
import { AppShell } from "../_components/app-shell";
import "./privada.css";

export const instant = false;

async function PharmacyContent({
  children,
  params,
}: PharmacyParams & { children: React.ReactNode }) {
  const pharmacy = await resolvePharmacy(params);
  const user = await requirePharmacyUser(pharmacy);
  return (
    <PharmacyProvider key={pharmacy} pharmacy={pharmacy}>
      <AppShell
        selected={pharmacy}
        permissions={rolePermissions(user.rol)}
        user={{
          name: [user.nombre, user.apellido].filter(Boolean).join(" "),
          role: isSuperAdmin(user) ? "Superadministrador" : user.rol.nombre,
          canSwitchPharmacy: isSuperAdmin(user),
        }}
      >
        <div className="private-module">{children}</div>
      </AppShell>
    </PharmacyProvider>
  );
}

export default function PharmacyLayout({
  children,
  params,
}: PharmacyParams & {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<p role="status">Cargando farmacia…</p>}>
      <PharmacyContent params={params}>{children}</PharmacyContent>
    </Suspense>
  );
}

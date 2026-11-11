import { type ReactNode, Suspense } from "react";
import { requirePharmacyUser } from "@/lib/auth/session";
import { AppShell } from "../_components/app-shell";

export const instant = false;

async function AsistencialContent({ children }: { children: ReactNode }) {
  const user = await requirePharmacyUser("asistencial");
  return (
    <AppShell
      selected="asistencial"
      user={{
        name: [user.nombre, user.apellido].filter(Boolean).join(" "),
        role: user.rol.nombre,
      }}
    >
      {children}
    </AppShell>
  );
}

export default function AsistencialLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <Suspense fallback={<p role="status">Cargando farmacia…</p>}>
      <AsistencialContent>{children}</AsistencialContent>
    </Suspense>
  );
}

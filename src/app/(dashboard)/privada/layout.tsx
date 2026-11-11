import { Suspense } from "react";
import { requirePharmacyUser } from "@/lib/auth/session";
import { AppShell } from "../_components/app-shell";
import "./private.css";

export const instant = false;

async function PrivateContent({ children }: { children: React.ReactNode }) {
  const user = await requirePharmacyUser("privada");
  return <AppShell selected="privada" user={{ name: [user.nombre, user.apellido].filter(Boolean).join(" "), role: user.rol.nombre }}><div className="private-module">{children}</div></AppShell>;
}

export default function PrivadaLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<p role="status">Cargando farmacia…</p>}><PrivateContent>{children}</PrivateContent></Suspense>;
}

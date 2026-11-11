import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { isPharmacy } from "@/lib/auth/pharmacies";
import { getPharmacyUser } from "@/lib/auth/session";
import { LoginCard } from "../_components/login-card";

export const metadata = { title: "Iniciar sesión | Farmacias INACAP" };
export const instant = false;

async function LoginContent({
  params,
}: {
  params: Promise<{ pharmacy: string }>;
}) {
  const { pharmacy } = await params;
  if (!isPharmacy(pharmacy)) notFound();
  if (await getPharmacyUser(pharmacy)) redirect(`/${pharmacy}`);
  return <LoginCard pharmacy={pharmacy} />;
}

export default function LoginPage(props: {
  params: Promise<{ pharmacy: string }>;
}) {
  return (
    <Suspense fallback={<p role="status">Cargando inicio de sesión…</p>}>
      <LoginContent {...props} />
    </Suspense>
  );
}

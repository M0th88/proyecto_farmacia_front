import { redirect } from "next/navigation";
import { Suspense } from "react";
import styles from "@/components/admin-table.module.css";
import { UserProfileForm } from "@/components/user-profile-form";
import {
  type PharmacyParams,
  resolvePharmacy,
} from "@/lib/auth/pharmacy-scope";
import { getPharmacyUser } from "@/lib/auth/session";
import { pharmacyDb } from "@/lib/db/pharmacy-db";
import { serializeUser, userSelect } from "@/lib/private/users";
import SettingsLoading from "./loading";

export const instant = false;
async function SettingsContent({ params }: PharmacyParams) {
  const pharmacy = await resolvePharmacy(params);
  const session = await getPharmacyUser(pharmacy);
  if (!session) redirect(`/login/${pharmacy}`);
  const user = await pharmacyDb(pharmacy).usuario.findUnique({
    where: { id: session.id },
    select: userSelect,
  });
  if (!user) redirect(`/login/${pharmacy}`);
  return (
    <section className={styles.page}>
      <h1 className={styles.title}>Configuración</h1>
      <p className={styles.note}>Edita los datos de tu cuenta.</p>
      <section className={styles.card}>
        <UserProfileForm
          selfService
          user={serializeUser(user)}
          currentUserId={user.id}
          roles={[{ id: user.rolId, nombre: user.rol.nombre }]}
        />
      </section>
    </section>
  );
}
export default function SettingsPage({ params }: PharmacyParams) {
  return (
    <Suspense fallback={<SettingsLoading />}>
      <SettingsContent params={params} />
    </Suspense>
  );
}

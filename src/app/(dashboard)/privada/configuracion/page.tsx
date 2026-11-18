import { redirect } from "next/navigation";
import { Suspense } from "react";
import styles from "@/components/admin-table.module.css";
import { UserProfileForm } from "@/components/user-profile-form";
import { getPrivateUser } from "@/lib/auth/session";
import { prismaPrivada } from "@/lib/db/prisma-privada";
import { serializeUser, userSelect } from "@/lib/private/users";
import SettingsLoading from "./loading";

export const instant = false;
async function SettingsContent() {
  const session = await getPrivateUser();
  if (!session) redirect("/login/privada");
  const user = await prismaPrivada.usuario.findUnique({
    where: { id: session.id },
    select: userSelect,
  });
  if (!user) redirect("/login/privada");
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
export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsLoading />}>
      <SettingsContent />
    </Suspense>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import styles from "@/components/admin-table.module.css";
import { UserProfileForm } from "@/components/user-profile-form";
import {
  type PharmacyParams,
  resolvePharmacy,
} from "@/lib/auth/pharmacy-scope";
import { requirePharmacyUser } from "@/lib/auth/session";
import { pharmacyDb } from "@/lib/db/pharmacy-db";
import { serializeUser, userSelect } from "@/lib/private/users";
import EditLoading from "./loading";

export const instant = false;

async function EditContent({
  params,
  searchParams,
}: PharmacyParams & {
  searchParams: Promise<{ usuario?: string }>;
}) {
  const pharmacy = await resolvePharmacy(params);
  const admin = await requirePharmacyUser(pharmacy);
  if (admin.rol.nombre !== "Administrador") redirect(`/${pharmacy}/sin-acceso`);
  const { usuario } = await searchParams;
  const id = usuario === undefined ? null : Number(usuario);
  if (id !== null && (!Number.isSafeInteger(id) || id < 1)) notFound();
  const selectedUser =
    id === null
      ? null
      : await pharmacyDb(pharmacy).usuario.findUnique({
          where: { id },
          select: userSelect,
        });
  if (id !== null && !selectedUser) notFound();
  const roles = selectedUser
    ? await pharmacyDb(pharmacy).rol.findMany({
        orderBy: { nombre: "asc" },
        select: {
          id: true,
          nombre: true,
          descripcion: true,
          permisos: true,
          _count: { select: { usuarios: true } },
        },
      })
    : [];
  return (
    <section className="pos-shell">
      <header className="pos-header">
        <div>
          <Link href={`/${pharmacy}/usuarios`}>
            ← Volver a la tabla de usuarios
          </Link>
          <h1>Usuarios</h1>
          <span>Crea perfiles y define qué secciones puede ver cada rol.</span>
        </div>
      </header>
      {selectedUser && (
        <section
          className={styles.card}
          aria-label="Editar usuario seleccionado"
        >
          <h2>
            Editar usuario: {selectedUser.nombre} {selectedUser.apellido}
          </h2>
          <UserProfileForm
            key={selectedUser.id}
            user={serializeUser(selectedUser)}
            roles={roles}
            currentUserId={admin.id}
          />
        </section>
      )}
    </section>
  );
}

export default function EditarUsuariosPage(
  props: PharmacyParams & {
    searchParams: Promise<{ usuario?: string }>;
  },
) {
  return (
    <Suspense fallback={<EditLoading />}>
      <EditContent {...props} />
    </Suspense>
  );
}

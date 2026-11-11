import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { requirePharmacyUser } from "@/lib/auth/session";
import { prismaPrivada } from "@/lib/db/prisma-privada";
import { serializeUser, userSelect } from "@/lib/private/users";
import { UserProfileForm } from "../_components/user-profile-form";
import styles from "../_components/usuarios-table.module.css";
import { UsuariosRoles } from "../_components/usuarios-y-roles";

export const instant = false;

async function EditContent({
  searchParams,
}: {
  searchParams: Promise<{ usuario?: string }>;
}) {
  const admin = await requirePharmacyUser("privada");
  if (admin.rol.nombre !== "Administrador") redirect("/privada/sin-acceso");
  const { usuario } = await searchParams;
  const id = usuario === undefined ? null : Number(usuario);
  if (id !== null && (!Number.isSafeInteger(id) || id < 1)) notFound();
  const selectedUser =
    id === null
      ? null
      : await prismaPrivada.usuario.findUnique({
          where: { id },
          select: userSelect,
        });
  if (id !== null && !selectedUser) notFound();
  const roles = selectedUser
    ? await prismaPrivada.rol.findMany({
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
          <Link href="/privada/usuarios-y-roles">
            ← Volver a la tabla de usuarios
          </Link>
          <p>FARMACIA PRIVADA / USUARIOS Y ROLES</p>
          <h1>Usuarios y roles</h1>
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
      <UsuariosRoles />
    </section>
  );
}

export default function EditarUsuariosPage(props: {
  searchParams: Promise<{ usuario?: string }>;
}) {
  return (
    <Suspense
      fallback={<p role="status">Cargando edición de usuarios y roles…</p>}
    >
      <EditContent {...props} />
    </Suspense>
  );
}

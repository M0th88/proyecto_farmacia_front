"use client";
import { useMemo, useState } from "react";
import { DataTable } from "@/components/data-table";
import type { User } from "@/lib/types/usuarios-y-roles";
import { listUsers, usersQueryKey } from "../actions";
import { createColumns } from "./columns";
import { DeleteUserDialog } from "./delete-user-dialog";
import { NewUserDialog } from "./new-user-dialog";
import { UserDetailsDialog } from "./user-details-dialog";
import styles from "./usuarios-table.module.css";

export function UsersTable({ currentUserId }: { currentUserId: number }) {
  const [viewedUser, setViewedUser] = useState<User | null>(null);
  const [deletedUser, setDeletedUser] = useState<User | null>(null);
  const columns = useMemo(
    () =>
      createColumns({
        currentUserId,
        onView: setViewedUser,
        onDelete: setDeletedUser,
      }),
    [currentUserId],
  );
  return (
    <section className={styles.page}>
      <h1 className={styles.title}>Usuarios y roles</h1>
      <DataTable<User>
        columns={columns}
        queryKey={[...usersQueryKey, currentUserId]}
        queryFn={listUsers}
        placeholder="Filtrar por nombre, apellido, correo, RUT, teléfono o rol"
        emptyTitle="No hay usuarios registrados. Crea un usuario para comenzar."
        createButton={<NewUserDialog currentUserId={currentUserId} />}
        getRowId={(user) => String(user.id)}
      />
      <UserDetailsDialog
        user={viewedUser}
        onClose={() => setViewedUser(null)}
      />
      <DeleteUserDialog
        user={deletedUser}
        onClose={() => setDeletedUser(null)}
      />
    </section>
  );
}

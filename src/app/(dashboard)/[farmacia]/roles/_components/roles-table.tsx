"use client";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import styles from "@/components/admin-table.module.css";
import { DataTable } from "@/components/data-table";
import { usePharmacy } from "@/components/pharmacy-provider";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { PRIVATE_SECTIONS } from "@/lib/private/permissions";
import type { Role } from "@/lib/types/usuarios-y-roles";
import { listRolesPage, rolesTableQueryKey } from "../actions";
import { DeleteRoleDialog } from "./delete-role-dialog";
import { RoleActions } from "./role-actions";
import { RoleProfileForm } from "./role-profile-form";
import roleStyles from "./roles.module.css";

export function RolesTable({ currentUserId }: { currentUserId: number }) {
  const pharmacy = usePharmacy();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [deleting, setDeleting] = useState<Role | null>(null);
  const close = () => {
    setCreating(false);
    setEditing(null);
  };
  const columns = useMemo<ColumnDef<Role>[]>(
    () => [
      { accessorKey: "id", header: "ID", size: 75 },
      {
        accessorKey: "nombre",
        header: "Rol",
        size: 210,
        cell: ({ row }) => (
          <span
            className={`${styles.badge} ${row.original.nombre === "Administrador" ? styles.admin : ""}`}
          >
            {row.original.nombre}
          </span>
        ),
      },
      {
        accessorKey: "descripcion",
        header: "Descripción",
        size: 280,
        cell: ({ getValue }) => (
          <span className={roleStyles.permissionList}>
            {getValue<string>() || "—"}
          </span>
        ),
      },
      {
        id: "permisos",
        accessorFn: (role) =>
          PRIVATE_SECTIONS.filter((section) =>
            role.permisos.includes(section.key),
          ),
        header: "Vistas permitidas",
        size: 400,
        cell: ({ getValue }) => {
          const sections = getValue<(typeof PRIVATE_SECTIONS)[number][]>();
          if (!sections.length) return "—";
          return (
            <ul className={roleStyles.permissionBadges}>
              {sections.map(({ key, label }) => (
                <li className={styles.badge} key={key}>
                  {label}
                </li>
              ))}
            </ul>
          );
        },
      },
      {
        id: "usuarios",
        accessorFn: (role) => role._count.usuarios,
        header: "Usuarios",
        size: 110,
      },
      {
        id: "acciones",
        header: "Acciones",
        size: 100,
        enableSorting: false,
        cell: ({ row }) => (
          <RoleActions
            role={row.original}
            onEdit={setEditing}
            onDelete={setDeleting}
          />
        ),
      },
    ],
    [],
  );
  return (
    <section className={styles.page}>
      <h1 className={styles.title}>Roles</h1>
      <DataTable<Role>
        entityLabel="roles"
        columns={columns}
        queryKey={[...rolesTableQueryKey, currentUserId]}
        queryFn={listRolesPage.bind(null, pharmacy)}
        placeholder="Filtrar por rol, descripción o vista permitida"
        emptyTitle="No hay roles registrados. Crea un rol para comenzar."
        createButton={
          <Button onClick={() => setCreating(true)}>
            Crear rol
            <Plus size={16} />
          </Button>
        }
        getRowId={(role) => String(role.id)}
      />
      <Modal
        open={creating || !!editing}
        onOpenChange={(open) => {
          if (!open) close();
        }}
        title={editing ? "Editar rol" : "Crear rol"}
        description="Ingresa el nombre, la descripción y las vistas permitidas para este rol."
      >
        {(creating || editing) && (
          <RoleProfileForm
            key={editing?.id ?? "new"}
            role={editing ?? undefined}
            onSaved={close}
            onCancel={close}
          />
        )}
      </Modal>
      <DeleteRoleDialog role={deleting} onClose={() => setDeleting(null)} />
    </section>
  );
}

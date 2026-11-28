"use client";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import styles from "@/components/admin-table.module.css";
import { DataTable } from "@/components/data-table";
import { usePharmacy } from "@/components/pharmacy-provider";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { resumenPermisos } from "@/lib/private/permisos-grupos";
import type { Role } from "@/lib/types/usuarios-y-roles";
import { listRolesPage, rolesTableQueryKey } from "../actions";
import { DeleteRoleDialog } from "./delete-role-dialog";
import { RoleActions } from "./role-actions";
import { RoleProfileForm } from "./role-profile-form";
import roleStyles from "./roles.module.css";

export type ResumenRoles = {
  roles: number;
  usuarios: number;
  sinUsuarios: number;
  conSensibles: number;
};

export function RolesTable({
  currentUserId,
  resumen,
}: {
  currentUserId: number;
  resumen: ResumenRoles;
}) {
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
        accessorFn: (role) => role.permisos.length,
        header: "Permisos",
        size: 300,
        cell: ({ row }) => {
          if (row.original.nombre === "Administrador")
            return <span className={roleStyles.total}>Acceso total</span>;
          const grupos = resumenPermisos(row.original.permisos);
          if (!grupos.length) return "—";
          return (
            <ul className={roleStyles.resumen}>
              {grupos.map((g) => (
                <li
                  key={g.titulo}
                  title={g.activos.map((p) => p.label).join(", ")}
                >
                  <b>
                    {g.activos.length}/{g.total}
                  </b>
                  <span>{g.titulo}</span>
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
      <header className={roleStyles.encabezado}>
        <h1 className={styles.title}>Roles</h1>
        <p>
          Define qué puede ver y hacer cada perfil. Los permisos marcados como
          sensibles (anular ventas, liberar cuarentena, firmar el libro de
          controlados) conviene darlos solo a quien supervisa.
        </p>
      </header>
      <dl className={roleStyles.metricas}>
        <div>
          <dt>Roles</dt>
          <dd>{resumen.roles}</dd>
        </div>
        <div>
          <dt>Usuarios asignados</dt>
          <dd>{resumen.usuarios}</dd>
        </div>
        <div>
          <dt>Roles sin usuarios</dt>
          <dd>{resumen.sinUsuarios}</dd>
        </div>
        <div>
          <dt>Con permisos sensibles</dt>
          <dd>{resumen.conSensibles}</dd>
        </div>
      </dl>
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
        description="Ingresa el nombre, la descripción y los permisos del rol. Puedes partir de una plantilla."
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

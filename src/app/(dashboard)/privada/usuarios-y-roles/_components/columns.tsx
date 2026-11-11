"use client";
import type { ColumnDef } from "@tanstack/react-table";
import type { User } from "@/lib/types/usuarios-y-roles";
import { UserActions } from "./user-actions";
import { UserStateToggle } from "./user-state-toggle";
import styles from "./usuarios-table.module.css";

export const formatUserDate = (value: string) =>
  new Intl.DateTimeFormat("es-CL", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Santiago",
  }).format(new Date(value));
export function createColumns({
  currentUserId,
  onView,
  onDelete,
}: {
  currentUserId: number;
  onView: (user: User) => void;
  onDelete: (user: User) => void;
}): ColumnDef<User>[] {
  return [
    {
      accessorKey: "activo",
      header: "Estado",
      size: 150,
      cell: ({ row }) => (
        <UserStateToggle user={row.original} currentUserId={currentUserId} />
      ),
    },
    { accessorKey: "id", header: "ID", size: 75 },
    { accessorKey: "nombre", header: "Nombre", size: 150 },
    {
      accessorKey: "apellido",
      header: "Apellido",
      size: 150,
      cell: ({ getValue }) => getValue<string>() || "—",
    },
    {
      id: "rol",
      accessorFn: (user) => user.rol.nombre,
      header: "Rol",
      size: 200,
      cell: ({ row, getValue }) => (
        <span
          className={`${styles.badge} ${row.original.rol.nombre === "Administrador" ? styles.admin : ""}`}
        >
          {getValue<string>()}
        </span>
      ),
    },
    { accessorKey: "email", header: "Correo", size: 250 },
    { accessorKey: "rut", header: "RUT", size: 150 },
    {
      accessorKey: "telefono",
      header: "Teléfono",
      size: 150,
      cell: ({ getValue }) => getValue<string>() || "—",
    },
    {
      accessorKey: "creadoEn",
      header: "Creado",
      size: 190,
      cell: ({ getValue }) => formatUserDate(getValue<string>()),
    },
    {
      accessorKey: "actualizadoEn",
      header: "Actualizado",
      size: 190,
      cell: ({ getValue }) => formatUserDate(getValue<string>()),
    },
    {
      id: "acciones",
      header: "Acciones",
      enableSorting: false,
      size: 100,
      cell: ({ row }) => (
        <UserActions
          user={row.original}
          currentUserId={currentUserId}
          onView={onView}
          onDelete={onDelete}
        />
      ),
    },
  ];
}

"use client";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useId } from "react";
import styles from "@/components/admin-table.module.css";
import { Button } from "@/components/ui/button";
import type { Role } from "@/lib/types/usuarios-y-roles";
import roleStyles from "./roles.module.css";

export function RoleActions({
  role,
  onEdit,
  onDelete,
}: {
  role: Role;
  onEdit: (role: Role) => void;
  onDelete: (role: Role) => void;
}) {
  const admin = role.nombre === "Administrador";
  const inUse = role._count.usuarios > 0;
  const reasonId = useId();
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="ghost" aria-label={`Acciones de ${role.nombre}`}>
          <MoreHorizontal size={18} />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={styles.menu}
          align="end"
          sideOffset={8}
          collisionPadding={8}
        >
          <DropdownMenu.Label className={styles.menuLabel}>
            Acciones
          </DropdownMenu.Label>
          <DropdownMenu.Item
            className={styles.menuItem}
            disabled={admin}
            onSelect={() => onEdit(role)}
          >
            <Pencil size={16} />
            Editar Roles
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className={`${styles.menuItem} ${styles.delete}`}
            disabled={admin || inUse}
            aria-describedby={admin || inUse ? reasonId : undefined}
            onSelect={() => onDelete(role)}
          >
            <Trash2 size={16} />
            Eliminar Roles
          </DropdownMenu.Item>
          {(admin || inUse) && (
            <p id={reasonId} className={roleStyles.actionNote}>
              {admin
                ? "El rol Administrador está protegido y no se puede editar ni eliminar."
                : "Este rol está en uso. Puedes editarlo, pero no eliminarlo mientras tenga usuarios asignados."}
            </p>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

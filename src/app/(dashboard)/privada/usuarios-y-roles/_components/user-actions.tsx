"use client";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Eye, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { User } from "@/lib/types/usuarios-y-roles";
import styles from "./usuarios-table.module.css";

export function UserActions({
  user,
  currentUserId,
  onView,
  onDelete,
}: {
  user: User;
  currentUserId: number;
  onView: (user: User) => void;
  onDelete: (user: User) => void;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button
          variant="ghost"
          aria-label={`Acciones de ${user.nombre} ${user.apellido ?? ""}`}
        >
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
            onSelect={() => onView(user)}
          >
            <Eye size={16} />
            Ver detalles
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild>
            <Link
              className={styles.menuItem}
              href={`/privada/usuarios-y-roles/editar?usuario=${user.id}`}
            >
              <Pencil size={16} />
              Editar usuario
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className={`${styles.menuItem} ${styles.delete}`}
            disabled={user.id === currentUserId}
            onSelect={() => onDelete(user)}
          >
            <Trash2 size={16} />
            Eliminar usuario
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

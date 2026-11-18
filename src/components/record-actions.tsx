"use client";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Eye, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import styles from "./admin-table.module.css";
import { Button } from "./ui/button";

export function RecordActions({
  name,
  canDelete,
  canEdit = true,
  onView,
  onEdit,
  onDelete,
}: {
  name: string;
  canDelete: boolean;
  canEdit?: boolean;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="ghost" aria-label={`Acciones de ${name}`}>
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
          <DropdownMenu.Item className={styles.menuItem} onSelect={onView}>
            <Eye size={16} />
            Ver detalles
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className={styles.menuItem}
            disabled={!canEdit}
            onSelect={onEdit}
          >
            <Pencil size={16} />
            Editar
          </DropdownMenu.Item>
          {canDelete && (
            <DropdownMenu.Item
              className={`${styles.menuItem} ${styles.delete}`}
              onSelect={onDelete}
            >
              <Trash2 size={16} />
              Eliminar
            </DropdownMenu.Item>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

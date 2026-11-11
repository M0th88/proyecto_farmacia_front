"use client";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import ui from "@/components/ui/ui.module.css";
import type { User } from "@/lib/types/usuarios-y-roles";
import { deleteUser, rolesQueryKey, usersQueryKey } from "../actions";
import styles from "./usuarios-table.module.css";

export function DeleteUserDialog({
  user,
  onClose,
}: {
  user: User | null;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => {
      if (!user) throw new Error("Selecciona un usuario.");
      return deleteUser(user.id);
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: usersQueryKey }),
        client.invalidateQueries({ queryKey: rolesQueryKey }),
      ]);
      toast.success("Usuario eliminado.");
      onClose();
    },
    onError: (error) => toast.error(error.message),
  });
  return (
    <AlertDialog.Root
      open={!!user}
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) onClose();
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={ui.overlay} />
        <AlertDialog.Content className={ui.modal}>
          <AlertDialog.Title className={ui.modalTitle}>
            Eliminar usuario
          </AlertDialog.Title>
          <AlertDialog.Description className={ui.description}>
            ¿Eliminar el perfil de {user?.nombre} {user?.apellido}? Esta acción
            es permanente. Para conservarlo sin permitir acceso, cambia su
            estado a Inactivo.
          </AlertDialog.Description>
          <div className={styles.footer}>
            <AlertDialog.Cancel asChild>
              <Button variant="outline" disabled={mutation.isPending}>
                Cancelar
              </Button>
            </AlertDialog.Cancel>
            <Button
              variant="danger"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? "Eliminando…" : "Eliminar usuario"}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

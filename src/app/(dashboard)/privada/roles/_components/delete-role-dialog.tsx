"use client";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import styles from "@/components/admin-table.module.css";
import { Button } from "@/components/ui/button";
import ui from "@/components/ui/ui.module.css";
import type { Role } from "@/lib/types/usuarios-y-roles";
import { rolesQueryKey } from "../../usuarios/actions";
import { deleteRole, rolesTableQueryKey } from "../actions";

export function DeleteRoleDialog({
  role,
  onClose,
}: {
  role: Role | null;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const router = useRouter();
  const mutation = useMutation({
    mutationFn: () => {
      if (!role) throw new Error("Selecciona un rol.");
      return deleteRole(role.id);
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: rolesTableQueryKey }),
        client.invalidateQueries({ queryKey: rolesQueryKey }),
      ]);
      toast.success("Rol eliminado.");
      onClose();
      router.refresh();
    },
    onError: (error) => toast.error(error.message),
  });
  return (
    <AlertDialog.Root
      open={!!role}
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) onClose();
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={ui.overlay} />
        <AlertDialog.Content className={ui.modal}>
          <AlertDialog.Title className={ui.modalTitle}>
            Eliminar rol
          </AlertDialog.Title>
          <AlertDialog.Description className={ui.description}>
            ¿Eliminar el rol {role?.nombre}? Esta acción es permanente. Solo se
            pueden eliminar roles sin usuarios asignados.
          </AlertDialog.Description>
          {mutation.isError && (
            <p role="alert" className={styles.error}>
              {mutation.error.message}
            </p>
          )}
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
              {mutation.isPending ? "Eliminando…" : "Eliminar rol"}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

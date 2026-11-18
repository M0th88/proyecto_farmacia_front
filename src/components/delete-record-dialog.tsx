"use client";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import styles from "./admin-table.module.css";
import { Button } from "./ui/button";
import ui from "./ui/ui.module.css";

export function DeleteRecordDialog({
  open,
  title,
  description,
  onDelete,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  onDelete: () => Promise<void>;
  onClose: () => void;
}) {
  const mutation = useMutation({
    mutationFn: onDelete,
    onSuccess: () => {
      toast.success("Registro eliminado.");
      onClose();
    },
    onError: (error) => toast.error(error.message),
  });
  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(value) => {
        if (!value && !mutation.isPending) onClose();
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={ui.overlay} />
        <AlertDialog.Content className={ui.modal}>
          <AlertDialog.Title className={ui.modalTitle}>
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description className={ui.description}>
            {description}
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
              {mutation.isPending ? "Eliminando…" : "Eliminar"}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

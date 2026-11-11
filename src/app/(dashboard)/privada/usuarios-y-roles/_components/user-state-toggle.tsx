"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import type { User } from "@/lib/types/usuarios-y-roles";
import { saveUser, usersQueryKey } from "../actions";
import styles from "./usuarios-table.module.css";

export function UserStateToggle({
  user,
  currentUserId,
}: {
  user: User;
  currentUserId: number;
}) {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => saveUser({ id: user.id, activo: !user.activo }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: usersQueryKey });
      toast.success("Estado actualizado.");
    },
    onError: (error) => toast.error(error.message),
  });
  return (
    <span
      className={styles.inline}
      title={
        user.id === currentUserId
          ? "No puedes desactivar tu propia cuenta"
          : undefined
      }
    >
      <Switch
        aria-label={`${user.activo ? "Desactivar" : "Activar"} a ${user.nombre} ${user.apellido ?? ""}`}
        checked={user.activo}
        onCheckedChange={() => mutation.mutate()}
        disabled={mutation.isPending || user.id === currentUserId}
      />
      <span>{user.activo ? "Activo" : "Inactivo"}</span>
    </span>
  );
}

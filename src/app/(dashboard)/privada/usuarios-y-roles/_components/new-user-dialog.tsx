"use client";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { listRoles, rolesQueryKey } from "../actions";
import { UserProfileForm } from "./user-profile-form";

export function NewUserDialog({ currentUserId }: { currentUserId: number }) {
  const [open, setOpen] = useState(false);
  const roles = useQuery({
    queryKey: [...rolesQueryKey, currentUserId],
    queryFn: listRoles,
    enabled: open,
  });
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        Crear usuario
        <Plus size={16} />
      </Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Crear usuario"
        description="Ingresa los datos del perfil y selecciona su rol en Farmacia Privada."
      >
        {roles.isPending ? (
          <Skeleton style={{ height: 240 }} />
        ) : roles.isError ? (
          <div role="alert">
            <p>{roles.error.message}</p>
            <Button variant="outline" onClick={() => void roles.refetch()}>
              Reintentar
            </Button>
          </div>
        ) : (
          <UserProfileForm
            roles={roles.data}
            currentUserId={currentUserId}
            onSaved={() => setOpen(false)}
            onCancel={() => setOpen(false)}
          />
        )}
      </Modal>
    </>
  );
}

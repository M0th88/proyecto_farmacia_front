"use client";
import Link from "next/link";
import { Modal } from "@/components/ui/modal";
import type { User } from "@/lib/types/usuarios-y-roles";
import { formatUserDate } from "./columns";
import styles from "./usuarios-table.module.css";

export function UserDetailsDialog({
  user,
  onClose,
}: {
  user: User | null;
  onClose: () => void;
}) {
  return (
    <Modal
      open={!!user}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Detalle del usuario"
      description="Datos del perfil registrado en Farmacia Privada."
    >
      {user && (
        <>
          <dl className={styles.details}>
            {Object.entries({
              ID: user.id,
              Nombre: user.nombre,
              Apellido: user.apellido || "—",
              RUT: user.rut,
              Correo: user.email,
              Teléfono: user.telefono || "—",
              Rol: user.rol.nombre,
              Estado: user.activo ? "Activo" : "Inactivo",
              Creado: formatUserDate(user.creadoEn),
              Actualizado: formatUserDate(user.actualizadoEn),
            }).map(([label, value]) => (
              <div key={label} style={{ display: "contents" }}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <Link
            className={styles.editLink}
            href={`/privada/usuarios-y-roles/editar?usuario=${user.id}`}
          >
            Editar usuario →
          </Link>
        </>
      )}
    </Modal>
  );
}

"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import styles from "@/components/admin-table.module.css";
import { Button } from "@/components/ui/button";
import { PRIVATE_SECTIONS } from "@/lib/private/permissions";
import { type RoleProfile, roleProfileSchema } from "@/lib/types/roles";
import type { Role } from "@/lib/types/usuarios-y-roles";
import { rolesQueryKey, usersQueryKey } from "../../usuarios/actions";
import { rolesTableQueryKey, saveRole } from "../actions";
import roleStyles from "./roles.module.css";

export function RoleProfileForm({
  role,
  onSaved,
  onCancel,
}: {
  role?: Role;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const id = useId();
  const client = useQueryClient();
  const router = useRouter();
  const form = useForm<RoleProfile>({
    resolver: zodResolver(roleProfileSchema),
    mode: "onBlur",
    defaultValues: {
      nombre: role?.nombre ?? "",
      descripcion: role?.descripcion ?? "",
      permisos: (role?.permisos ?? ["inicio"]) as RoleProfile["permisos"],
    },
  });
  const description = useWatch({ control: form.control, name: "descripcion" });
  const descriptionLength = description.length;
  const descriptionOverLimit = descriptionLength > 500;
  const mutation = useMutation({
    mutationFn: (values: RoleProfile) =>
      saveRole({ ...values, ...(role ? { id: role.id } : {}) }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: rolesTableQueryKey }),
        client.invalidateQueries({ queryKey: rolesQueryKey }),
        client.invalidateQueries({ queryKey: usersQueryKey }),
      ]);
      toast.success(role ? "Rol actualizado." : "Rol creado.");
      onSaved();
      router.refresh();
    },
    onError: (error) => {
      form.setError("root", { message: error.message });
      toast.error(error.message);
    },
  });
  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
      aria-busy={mutation.isPending}
    >
      <div className={styles.fields}>
        {(
          [
            ["nombre", "Nombre del rol"],
            ["descripcion", "Descripción"],
          ] as const
        ).map(([name, label]) => (
          <label className={styles.field} key={name} htmlFor={`${id}-${name}`}>
            {label}
            {name === "descripcion" ? (
              <textarea
                id={`${id}-${name}`}
                className={roleStyles.description}
                rows={3}
                required
                {...form.register(name)}
                disabled={mutation.isPending}
                aria-invalid={
                  descriptionOverLimit || !!form.formState.errors[name]
                }
                aria-describedby={
                  form.formState.errors[name]
                    ? `${id}-description-help ${id}-${name}-error`
                    : `${id}-description-help`
                }
              />
            ) : (
              <input
                id={`${id}-${name}`}
                {...form.register(name)}
                disabled={mutation.isPending}
                aria-invalid={!!form.formState.errors[name]}
                aria-describedby={
                  form.formState.errors[name]
                    ? `${id}-${name}-error`
                    : undefined
                }
              />
            )}
            {name === "descripcion" && (
              <small
                id={`${id}-description-help`}
                className={`${roleStyles.counter} ${descriptionOverLimit ? roleStyles.overLimit : ""}`}
                aria-live="polite"
                aria-atomic="true"
              >
                {descriptionLength} / 500
              </small>
            )}
            {form.formState.errors[name] && (
              <span id={`${id}-${name}-error`} className={styles.error}>
                {form.formState.errors[name]?.message}
              </span>
            )}
          </label>
        ))}
      </div>
      <fieldset
        className={roleStyles.permissions}
        disabled={mutation.isPending}
        aria-describedby={
          form.formState.errors.permisos ? `${id}-permissions-error` : undefined
        }
      >
        <legend>Vistas permitidas</legend>
        <div className={roleStyles.permissionGrid}>
          {PRIVATE_SECTIONS.filter(
            (section) => section.key !== "usuarios" && section.key !== "roles",
          ).map((section) => (
            <label className={styles.inline} key={section.key}>
              <input
                type="checkbox"
                value={section.key}
                {...form.register("permisos")}
              />
              {section.label}
            </label>
          ))}
        </div>
      </fieldset>
      {form.formState.errors.permisos && (
        <p id={`${id}-permissions-error`} className={styles.error}>
          {form.formState.errors.permisos.message}
        </p>
      )}
      {form.formState.errors.root && (
        <p role="alert" className={styles.error}>
          {form.formState.errors.root.message}
        </p>
      )}
      <div className={styles.footer}>
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={mutation.isPending}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending && <LoaderCircle size={16} />}
          {mutation.isPending
            ? "Guardando…"
            : role
              ? "Guardar cambios"
              : "Crear rol"}
        </Button>
      </div>
    </form>
  );
}

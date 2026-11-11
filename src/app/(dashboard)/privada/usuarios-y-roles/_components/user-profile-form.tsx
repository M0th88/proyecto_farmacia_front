"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  type Role,
  type User,
  type UserProfile,
  userProfileSchema,
} from "@/lib/types/usuarios-y-roles";
import { rolesQueryKey, saveUser, usersQueryKey } from "../actions";
import styles from "./usuarios-table.module.css";

type Props = {
  roles: Role[];
  currentUserId: number;
  user?: User;
  onSaved?: () => void;
  onCancel?: () => void;
};
export function UserProfileForm({
  roles,
  currentUserId,
  user,
  onSaved,
  onCancel,
}: Props) {
  const id = useId();
  const [showPassword, setShowPassword] = useState(false);
  const queryClient = useQueryClient();
  const router = useRouter();
  const self = user?.id === currentUserId;
  const form = useForm<UserProfile>({
    resolver: zodResolver(userProfileSchema),
    mode: "onBlur",
    defaultValues: {
      nombre: user?.nombre ?? "",
      apellido: user?.apellido ?? "",
      rut: user?.rut ?? "",
      email: user?.email ?? "",
      telefono: user?.telefono ?? "",
      rolId: user?.rolId ?? roles[0]?.id ?? 0,
      activo: user?.activo ?? true,
      password: "",
    },
  });
  const mutation = useMutation({
    mutationFn: (values: UserProfile) =>
      saveUser({
        ...values,
        ...(user ? { id: user.id } : {}),
        ...(self ? { activo: user.activo, rolId: user.rolId } : {}),
      }),
    onSuccess: async (updated) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: usersQueryKey }),
        queryClient.invalidateQueries({ queryKey: rolesQueryKey }),
      ]);
      form.reset({
        nombre: updated.nombre,
        apellido: updated.apellido ?? "",
        rut: updated.rut,
        email: updated.email,
        telefono: updated.telefono ?? "",
        rolId: updated.rolId,
        activo: updated.activo,
        password: "",
      });
      toast.success(user ? "Usuario actualizado." : "Usuario creado.");
      onSaved?.();
      router.refresh();
    },
    onError: (error) => {
      form.setError("root", { message: error.message });
      toast.error(error.message);
    },
  });
  const submit = form.handleSubmit((values) => {
    if (!user && !values.password) {
      form.setError("password", {
        message: "Ingresa una contraseña inicial de al menos 12 caracteres.",
      });
      return;
    }
    mutation.mutate(values);
  });
  const fields = [
    {
      name: "nombre",
      label: "Nombre",
      type: "text",
      autoComplete: "given-name",
    },
    {
      name: "apellido",
      label: "Apellido",
      type: "text",
      autoComplete: "family-name",
    },
    { name: "rut", label: "RUT", type: "text", autoComplete: "off" },
    { name: "email", label: "Correo", type: "email", autoComplete: "email" },
    { name: "telefono", label: "Teléfono", type: "tel", autoComplete: "tel" },
  ] as const;
  return (
    <form
      className={styles.form}
      onSubmit={submit}
      noValidate
      aria-busy={mutation.isPending}
    >
      <div className={styles.fields}>
        {fields.map((field) => (
          <label
            className={styles.field}
            key={field.name}
            htmlFor={`${id}-${field.name}`}
          >
            {field.label}
            <input
              id={`${id}-${field.name}`}
              type={field.type}
              autoComplete={field.autoComplete}
              {...form.register(field.name)}
              disabled={mutation.isPending}
              aria-invalid={!!form.formState.errors[field.name]}
              aria-describedby={
                form.formState.errors[field.name]
                  ? `${id}-${field.name}-error`
                  : undefined
              }
            />
            {form.formState.errors[field.name] && (
              <span id={`${id}-${field.name}-error`} className={styles.error}>
                {form.formState.errors[field.name]?.message}
              </span>
            )}
          </label>
        ))}
        <label className={styles.field} htmlFor={`${id}-rol`}>
          Rol
          {self ? (
            <>
              <input id={`${id}-rol`} value={user.rol.nombre} readOnly />
              <input
                type="hidden"
                {...form.register("rolId", { valueAsNumber: true })}
              />
            </>
          ) : (
            <select
              id={`${id}-rol`}
              {...form.register("rolId", { valueAsNumber: true })}
              disabled={mutation.isPending}
            >
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.nombre}
                </option>
              ))}
            </select>
          )}
          {form.formState.errors.rolId && (
            <span className={styles.error}>
              {form.formState.errors.rolId.message}
            </span>
          )}
        </label>
        <div className={styles.field}>
          <label htmlFor={`${id}-password`}>
            {user ? "Nueva contraseña" : "Contraseña inicial"}
          </label>
          <div className={styles.inline}>
            <input
              id={`${id}-password`}
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              {...form.register("password")}
              disabled={mutation.isPending}
              aria-describedby={`${id}-password-help`}
            />
            <Button
              variant="outline"
              disabled={mutation.isPending}
              aria-controls={`${id}-password`}
              aria-pressed={showPassword}
              aria-label={
                showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
              }
              onClick={() => setShowPassword((visible) => !visible)}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </Button>
          </div>
          <small id={`${id}-password-help`}>
            {user
              ? "Déjala vacía para conservar la contraseña actual."
              : "Al menos 12 caracteres; máximo 72 bytes."}
          </small>
          {form.formState.errors.password && (
            <span className={styles.error}>
              {form.formState.errors.password.message}
            </span>
          )}
        </div>
        <label className={styles.inline}>
          {self ? (
            <input type="checkbox" checked={user.activo} disabled />
          ) : (
            <input
              type="checkbox"
              {...form.register("activo")}
              disabled={mutation.isPending}
            />
          )}
          Usuario activo
        </label>
      </div>
      {self && (
        <p className={styles.note}>
          Puedes editar tu perfil. Tu cuenta administradora debe permanecer
          activa y conservar su rol.
        </p>
      )}
      {form.formState.errors.root && (
        <p role="alert" className={styles.error}>
          {form.formState.errors.root.message}
        </p>
      )}
      <div className={styles.footer}>
        {onCancel && (
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={mutation.isPending}
          >
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending && <LoaderCircle size={16} />}
          {mutation.isPending
            ? "Guardando…"
            : user
              ? "Guardar cambios"
              : "Crear usuario"}
        </Button>
      </div>
    </form>
  );
}

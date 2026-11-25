"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  rolesQueryKey,
  saveOwnProfile,
  saveUser,
  usersQueryKey,
} from "@/app/(dashboard)/[farmacia]/usuarios/actions";
import styles from "@/components/admin-table.module.css";
import { usePharmacy } from "@/components/pharmacy-provider";
import { Button } from "@/components/ui/button";
import {
  type Role,
  type User,
  type UserProfile,
  userCreateProfileSchema,
  userProfileSchema,
} from "@/lib/types/usuarios-y-roles";
import { formatRut, mobilePhoneDigits } from "@/lib/user-input";
import { normalizePhone } from "@/lib/validation/user-fields";
import { RutInput } from "./rut-input";
import formStyles from "./user-profile-form.module.css";

type Props = {
  roles: Pick<Role, "id" | "nombre">[];
  currentUserId: number;
  user?: User;
  onSaved?: () => void;
  onCancel?: () => void;
  selfService?: boolean;
};
export function UserProfileForm({
  roles,
  currentUserId,
  user,
  onSaved,
  onCancel,
  selfService = false,
}: Props) {
  const pharmacy = usePharmacy();
  const id = useId();
  const [showPassword, setShowPassword] = useState(false);
  const queryClient = useQueryClient();
  const router = useRouter();
  const self = user?.id === currentUserId;
  const mobilePhone =
    !user?.telefono || /^(?:\+?56)?9\d{8}$/.test(normalizePhone(user.telefono));
  const form = useForm<UserProfile>({
    resolver: zodResolver(user ? userProfileSchema : userCreateProfileSchema),
    mode: "onBlur",
    defaultValues: {
      nombre: user?.nombre ?? "",
      apellido: user?.apellido ?? "",
      rut: formatRut(user?.rut ?? ""),
      email: user?.email ?? "",
      telefono: user?.telefono ?? "",
      rolId: user?.rolId ?? roles[0]?.id ?? 0,
      activo: user?.activo ?? true,
      password: "",
    },
  });
  const mutation = useMutation({
    mutationFn: (values: UserProfile) =>
      selfService
        ? saveOwnProfile(pharmacy, {
            nombre: values.nombre,
            apellido: values.apellido,
            rut: values.rut,
            email: values.email,
            telefono: values.telefono,
            password: values.password,
          })
        : saveUser(pharmacy, {
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
            {field.name === "rut" ? (
              <Controller
                control={form.control}
                name="rut"
                render={({ field: rut }) => (
                  <RutInput
                    id={`${id}-rut`}
                    value={rut.value}
                    onChange={rut.onChange}
                    onBlur={rut.onBlur}
                    inputRef={rut.ref}
                    disabled={mutation.isPending}
                    aria-invalid={!!form.formState.errors.rut}
                    aria-describedby={
                      form.formState.errors.rut ? `${id}-rut-error` : undefined
                    }
                  />
                )}
              />
            ) : field.name === "telefono" && mobilePhone ? (
              <Controller
                control={form.control}
                name="telefono"
                render={({ field: phone }) => (
                  <div className={formStyles.phoneInput}>
                    <span id={`${id}-phone-prefix`}>+56 9</span>
                    <input
                      id={`${id}-telefono`}
                      ref={phone.ref}
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel-national"
                      placeholder="1234 5678"
                      value={mobilePhoneDigits(phone.value)}
                      onBlur={phone.onBlur}
                      onChange={(event) => {
                        const digits = mobilePhoneDigits(event.target.value);
                        phone.onChange(digits ? `+569${digits}` : "");
                      }}
                      disabled={mutation.isPending}
                      aria-invalid={!!form.formState.errors.telefono}
                      aria-describedby={`${id}-phone-prefix${form.formState.errors.telefono ? ` ${id}-telefono-error` : ""}`}
                    />
                  </div>
                )}
              />
            ) : (
              <input
                id={`${id}-${field.name}`}
                type={field.type}
                autoComplete={field.autoComplete}
                placeholder={
                  field.name === "telefono"
                    ? "+56 9 1234 5678"
                    : field.name === "email"
                      ? "nombre@dominio.cl"
                      : undefined
                }
                maxLength={
                  field.name === "telefono"
                    ? 30
                    : field.name === "email"
                      ? 254
                      : 80
                }
                {...form.register(field.name)}
                disabled={mutation.isPending}
                aria-invalid={!!form.formState.errors[field.name]}
                aria-describedby={
                  form.formState.errors[field.name]
                    ? `${id}-${field.name}-error`
                    : undefined
                }
              />
            )}
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
              <input
                id={`${id}-rol`}
                value={user.rol.nombre}
                readOnly
                aria-describedby={selfService ? `${id}-rol-help` : undefined}
              />
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
          {self && selfService && (
            <small id={`${id}-rol-help`}>
              Tu rol solo puede cambiarlo un administrador.
            </small>
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
              aria-invalid={!!form.formState.errors.password}
              aria-describedby={`${id}-password-help${form.formState.errors.password ? ` ${id}-password-error` : ""}`}
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
              : "Mínimo 8 caracteres, mayúscula, minúscula, número y carácter especial."}
          </small>
          {form.formState.errors.password && (
            <div
              id={`${id}-password-error`}
              className={styles.error}
              role="alert"
            >
              <p>Requisitos pendientes:</p>
              <ul>
                {form.formState.errors.password.message
                  ?.split("\n")
                  .filter(Boolean)
                  .map((message) => (
                    <li key={message}>{message}</li>
                  ))}
              </ul>
            </div>
          )}
        </div>
        <label className={`${styles.inline} ${formStyles.activeToggle}`}>
          Usuario activo
          {self ? (
            <input type="checkbox" checked={user.activo} disabled />
          ) : (
            <input
              type="checkbox"
              {...form.register("activo")}
              disabled={mutation.isPending}
            />
          )}
        </label>
      </div>
      {self && !selfService && (
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

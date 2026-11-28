"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import styles from "@/components/admin-table.module.css";
import { usePharmacy } from "@/components/pharmacy-provider";
import { Button } from "@/components/ui/button";
import { GRUPOS_PERMISOS, PLANTILLAS_ROL } from "@/lib/private/permisos-grupos";
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
  const pharmacy = usePharmacy();
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
  const permisos = (useWatch({ control: form.control, name: "permisos" }) ??
    []) as string[];
  const totalPermisos = GRUPOS_PERMISOS.reduce(
    (n, g) => n + g.permisos.length,
    0,
  );
  const aplicar = (claves: string[]) =>
    form.setValue("permisos", claves as RoleProfile["permisos"], {
      shouldDirty: true,
      shouldValidate: true,
    });
  const descriptionOverLimit = descriptionLength > 500;
  const mutation = useMutation({
    mutationFn: (values: RoleProfile) =>
      saveRole(pharmacy, { ...values, ...(role ? { id: role.id } : {}) }),
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
        <legend>
          Permisos del rol{" "}
          <span className={roleStyles.contador}>
            {permisos.length} de {totalPermisos}
          </span>
        </legend>
        {!role && (
          <div className={roleStyles.plantillas}>
            <span>Partir de una plantilla:</span>
            {PLANTILLAS_ROL.map((p) => (
              <button
                key={p.nombre}
                type="button"
                className={roleStyles.plantilla}
                onClick={() => {
                  aplicar(p.permisos);
                  if (!form.getValues("nombre"))
                    form.setValue("nombre", p.nombre, {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                }}
              >
                {p.nombre}
              </button>
            ))}
          </div>
        )}
        {GRUPOS_PERMISOS.map((grupo) => {
          const claves = grupo.permisos.map((p) => p.key);
          const marcados = claves.filter((k) => permisos.includes(k)).length;
          const todos = marcados === claves.length;
          return (
            <section className={roleStyles.grupo} key={grupo.id}>
              <header className={roleStyles.grupoTitulo}>
                <h3>{grupo.titulo}</h3>
                <span>
                  {marcados}/{claves.length}
                </span>
                <button
                  type="button"
                  className={roleStyles.marcarTodo}
                  onClick={() =>
                    aplicar(
                      todos
                        ? permisos.filter((k) => !claves.includes(k))
                        : [...new Set([...permisos, ...claves])],
                    )
                  }
                >
                  {todos ? "Quitar todos" : "Marcar todos"}
                </button>
              </header>
              <div className={roleStyles.permissionGrid}>
                {grupo.permisos.map((permiso) => (
                  <label
                    className={roleStyles.permiso}
                    key={permiso.key}
                    data-sensible={permiso.sensible || undefined}
                  >
                    <input
                      type="checkbox"
                      value={permiso.key}
                      {...form.register("permisos")}
                    />
                    <span>
                      <b>
                        {permiso.label}
                        {permiso.sensible && (
                          <em className={roleStyles.sensible}>sensible</em>
                        )}
                      </b>
                      <small>{permiso.descripcion}</small>
                    </span>
                  </label>
                ))}
              </div>
            </section>
          );
        })}
        <p className={roleStyles.nota}>
          Usuarios y Roles son exclusivos del Administrador y no se asignan a
          otros roles.
        </p>
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

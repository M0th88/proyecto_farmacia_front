"use client";

import styles from "./admin-table.module.css";
import { Button } from "./ui/button";
import { Modal } from "./ui/modal";

export type Field = {
  key: string;
  label: string;
  type?: string;
  options?: { value: string | number; label: string }[];
  optional?: boolean;
};
export type Action = {
  title: string;
  body: Record<string, unknown>;
  fields: Field[];
  url?: string;
};
export function InventarioActionDialog({
  action,
  onChange,
  onSubmit,
  pending,
  error,
  description,
}: {
  action: Action;
  onChange: (action: Action | null) => void;
  onSubmit: (body: Record<string, unknown>) => void;
  pending: boolean;
  error?: string;
  description: string;
}) {
  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open && !pending) onChange(null);
      }}
      title={action.title}
      description={description}
    >
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(action.body);
        }}
      >
        {action.fields.map((field) => (
          <label
            key={field.key}
            className={field.type === "checkbox" ? styles.inline : styles.field}
          >
            {field.label}
            {field.options ? (
              <select
                value={String(action.body[field.key] ?? "")}
                onChange={(event) =>
                  onChange({
                    ...action,
                    body: {
                      ...action.body,
                      [field.key]:
                        field.type === "number"
                          ? Number(event.target.value)
                          : event.target.value,
                    },
                  })
                }
                required
              >
                <option value="">Selecciona una opción</option>
                {field.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={field.type ?? "text"}
                required={
                  field.type === "checkbox"
                    ? field.key === "confirmado"
                    : !field.optional
                }
                checked={
                  field.type === "checkbox"
                    ? Boolean(action.body[field.key])
                    : undefined
                }
                value={
                  field.type === "checkbox"
                    ? undefined
                    : String(action.body[field.key] ?? "")
                }
                onChange={(event) =>
                  onChange({
                    ...action,
                    body: {
                      ...action.body,
                      [field.key]:
                        field.type === "checkbox"
                          ? event.target.checked
                          : field.type === "number"
                            ? Number(event.target.value)
                            : event.target.value,
                    },
                  })
                }
              />
            )}
          </label>
        ))}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <div className={styles.footer}>
          <Button
            type="button"
            variant="outline"
            onClick={() => onChange(null)}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Registrando…" : "Confirmar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

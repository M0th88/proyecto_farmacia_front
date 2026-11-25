"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import styles from "@/components/admin-table.module.css";
import { usePharmacy } from "@/components/pharmacy-provider";
import { RecordDetails } from "@/components/record-details";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { stockDate } from "@/lib/private/stock-dates";
import {
  type StockEdit,
  type StockRow,
  stockEditSchema,
} from "@/lib/types/stock-y-lotes";
import { productsQueryKey } from "../../productos-y-empaques/actions";
import {
  stockOptions,
  stockOptionsQueryKey,
  stockQueryKey,
  updateStock,
} from "../actions";
import { StockForm } from "./stock-form";

export function StockRecordDialog({
  row,
  editing,
  onClose,
}: {
  row: StockRow;
  editing: boolean;
  onClose: () => void;
}) {
  const pharmacy = usePharmacy();
  const [saving, setSaving] = useState(false);
  const options = useQuery({
    queryKey: [...stockOptionsQueryKey, "edit", row.medicamentoId],
    queryFn: stockOptions.bind(null, pharmacy),
    enabled: editing && row.loteId === null,
  });
  const date = (value: string | null) =>
    value ? stockDate(new Date(value)) : "—";
  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
      title={editing ? "Editar stock y lote" : "Detalle de stock y lote"}
      description="Datos del producto, el lote y su existencia en esta ubicación."
    >
      {editing ? (
        row.loteId !== null ? (
          <StockEditForm
            row={row}
            onSaved={onClose}
            onSavingChange={setSaving}
          />
        ) : options.isPending ? (
          <Skeleton style={{ height: 300 }} />
        ) : options.isError ? (
          <div role="alert">
            <p>{options.error.message}</p>
            <Button onClick={() => void options.refetch()}>Reintentar</Button>
          </div>
        ) : (
          <>
            <p className={styles.note}>
              Este producto aún no tiene lotes. Completa los datos para
              registrar su stock.
            </p>
            <StockForm
              options={options.data}
              initialProductId={row.medicamentoId}
              onSaved={onClose}
              onCancel={onClose}
              onSavingChange={setSaving}
            />
          </>
        )
      ) : (
        <>
          <RecordDetails
            fields={{
              Producto: row.nombre,
              "Código de barras": row.codigo,
              Lote: row.numeroLote,
              Fabricación: date(row.fechaFabricacion),
              Vencimiento: date(row.fechaVencimiento),
              Ubicación: row.ubicacion,
              Stock: row.cantidad,
              "Stock mínimo del producto": row.minimo,
              "Precio (CLP)": row.precio,
              "Condición de venta": row.condicion,
              Estado: row.estado,
            }}
          />
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </>
      )}
    </Modal>
  );
}

function StockEditForm({
  row,
  onSaved,
  onSavingChange,
}: {
  row: StockRow;
  onSaved: () => void;
  onSavingChange: (saving: boolean) => void;
}) {
  const id = useId();
  const client = useQueryClient();
  const router = useRouter();
  const form = useForm<StockEdit>({
    resolver: zodResolver(stockEditSchema),
    mode: "onBlur",
    defaultValues: {
      loteId: row.loteId ?? 0,
      stockId: row.stockId,
      cantidadAnterior: row.cantidad,
      numeroLote: row.numeroLote ?? "",
      fechaFabricacion: row.fechaFabricacion
        ? stockDate(new Date(row.fechaFabricacion))
        : "",
      fechaVencimiento: row.fechaVencimiento
        ? stockDate(new Date(row.fechaVencimiento))
        : "",
      cantidad: row.cantidad,
      motivo: "",
    },
  });
  const pharmacy = usePharmacy();
  const mutation = useMutation({
    mutationFn: updateStock.bind(null, pharmacy),
    onMutate: () => onSavingChange(true),
    onSuccess: async () => {
      await Promise.all(
        [stockQueryKey, stockOptionsQueryKey, productsQueryKey].map(
          (queryKey) => client.invalidateQueries({ queryKey }),
        ),
      );
      toast.success("Stock y lote actualizados.");
      router.refresh();
      onSaved();
    },
    onError: (error) => form.setError("root", { message: error.message }),
    onSettled: () => onSavingChange(false),
  });
  return (
    <form
      className={styles.form}
      noValidate
      aria-busy={mutation.isPending}
      onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
    >
      <RecordDetails
        fields={{
          Producto: row.nombre,
          Ubicación: row.ubicacion ?? "Sin ubicación",
        }}
      />
      <p className={styles.note}>
        El número de lote y las fechas se comparten entre todas sus ubicaciones.
        La cantidad corresponde a esta ubicación y el cambio quedará registrado
        como ajuste.
      </p>
      <div className={styles.fields}>
        {(
          [
            ["numeroLote", "Número de lote", "text"],
            ["fechaFabricacion", "Fecha de fabricación", "date"],
            ["fechaVencimiento", "Fecha de vencimiento", "date"],
            ["cantidad", "Stock actual", "number"],
          ] as const
        ).map(([name, label, type]) => (
          <label className={styles.field} htmlFor={`${id}-${name}`} key={name}>
            {label}
            <input
              id={`${id}-${name}`}
              type={type}
              {...form.register(
                name,
                name === "cantidad" ? { valueAsNumber: true } : {},
              )}
              disabled={mutation.isPending}
              readOnly={name === "cantidad" && row.stockId === null}
              min={type === "number" ? 0 : undefined}
              step={type === "number" ? 1 : undefined}
              max={
                name === "fechaFabricacion"
                  ? stockDate(new Date())
                  : type === "number"
                    ? 2147483647
                    : undefined
              }
              aria-invalid={!!form.formState.errors[name]}
              aria-describedby={
                form.formState.errors[name] ? `${id}-${name}-error` : undefined
              }
            />
            {form.formState.errors[name] && (
              <span id={`${id}-${name}-error`} className={styles.error}>
                {form.formState.errors[name]?.message}
              </span>
            )}
          </label>
        ))}
      </div>
      <label className={styles.field} htmlFor={`${id}-motivo`}>
        Motivo del cambio
        <textarea
          id={`${id}-motivo`}
          rows={2}
          maxLength={500}
          style={{ resize: "vertical" }}
          {...form.register("motivo")}
          disabled={mutation.isPending}
          aria-invalid={!!form.formState.errors.motivo}
        />
        {form.formState.errors.motivo && (
          <span className={styles.error}>
            {form.formState.errors.motivo.message}
          </span>
        )}
      </label>
      {form.formState.errors.root && (
        <p role="alert" className={styles.error}>
          {form.formState.errors.root.message}
        </p>
      )}
      <div className={styles.footer}>
        <Button
          variant="outline"
          onClick={onSaved}
          disabled={mutation.isPending}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}

"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import styles from "@/components/admin-table.module.css";
import { Button } from "@/components/ui/button";
import { stockDate } from "@/lib/private/stock-dates";
import {
  type StockEntry,
  type StockOptions,
  stockEntrySchema,
} from "@/lib/types/stock-y-lotes";
import { productsQueryKey } from "../../productos/actions";
import { saveStock, stockOptionsQueryKey, stockQueryKey } from "../actions";
import { ProductSearch } from "./product-search";

export function StockForm({
  options,
  onSaved,
  onCancel,
  onSavingChange,
  initialProductId = 0,
}: {
  options: StockOptions;
  onSaved: () => void;
  onCancel: () => void;
  onSavingChange: (saving: boolean) => void;
  initialProductId?: number;
}) {
  const id = useId();
  const client = useQueryClient();
  const router = useRouter();
  const form = useForm<StockEntry>({
    resolver: zodResolver(stockEntrySchema),
    mode: "onBlur",
    defaultValues: {
      medicamentoId: initialProductId,
      numeroLote: "",
      fechaFabricacion: "",
      fechaVencimiento: "",
      ubicacionId: options.ubicaciones[0]?.id ?? 0,
      ubicacionNombre: "",
      ubicacionTipo: "BODEGA",
      cantidad: 1,
      motivo: "",
    },
  });
  const productId = useWatch({ control: form.control, name: "medicamentoId" });
  const lotNumber = useWatch({ control: form.control, name: "numeroLote" });
  const locationId = useWatch({ control: form.control, name: "ubicacionId" });
  const product = options.productos.find((item) => item.id === productId);
  const existingLot = product?.lotes.find(
    (lot) => lot.numeroLote === lotNumber.trim(),
  );
  const mutation = useMutation({
    mutationFn: saveStock,
    onMutate: () => onSavingChange(true),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: stockQueryKey }),
        client.invalidateQueries({ queryKey: stockOptionsQueryKey }),
        client.invalidateQueries({ queryKey: productsQueryKey }),
      ]);
      toast.success("Stock añadido.");
      onSaved();
      router.refresh();
    },
    onError: (error) => {
      form.setError("root", { message: error.message });
      toast.error(error.message);
    },
    onSettled: () => onSavingChange(false),
  });
  const error = (name: keyof StockEntry) =>
    form.formState.errors[name] ? (
      <span id={`${id}-${name}-error`} className={styles.error}>
        {form.formState.errors[name]?.message}
      </span>
    ) : null;
  const field = (name: keyof StockEntry) => ({
    id: `${id}-${name}`,
    disabled: mutation.isPending,
    "aria-invalid": !!form.formState.errors[name],
    "aria-describedby": form.formState.errors[name]
      ? `${id}-${name}-error`
      : undefined,
  });
  return (
    <form
      className={styles.form}
      noValidate
      aria-busy={mutation.isPending}
      onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
    >
      <div className={styles.fields}>
        <div className={styles.field}>
          <label htmlFor={`${id}-medicamentoId`}>Producto</label>
          <Controller
            control={form.control}
            name="medicamentoId"
            render={({ field: productField }) => (
              <ProductSearch
                id={`${id}-medicamentoId`}
                products={options.productos}
                value={productField.value}
                inputRef={productField.ref}
                onBlur={productField.onBlur}
                disabled={mutation.isPending}
                invalid={!!form.formState.errors.medicamentoId}
                describedBy={field("medicamentoId")["aria-describedby"]}
                onChange={(value) => {
                  productField.onChange(value);
                  form.setValue("numeroLote", "");
                  form.setValue("fechaFabricacion", "");
                  form.setValue("fechaVencimiento", "");
                }}
              />
            )}
          />
          {error("medicamentoId")}
        </div>
        <label className={styles.field} htmlFor={`${id}-numeroLote`}>
          Número de lote
          <input
            {...field("numeroLote")}
            list={`${id}-lotes`}
            maxLength={100}
            {...form.register("numeroLote", {
              onChange: (event) => {
                const lot = product?.lotes.find(
                  (item) => item.numeroLote === event.target.value.trim(),
                );
                form.setValue("fechaFabricacion", lot?.fechaFabricacion ?? "");
                form.setValue("fechaVencimiento", lot?.fechaVencimiento ?? "");
              },
            })}
          />
          <datalist id={`${id}-lotes`}>
            {product?.lotes.map((lot) => (
              <option key={lot.numeroLote} value={lot.numeroLote} />
            ))}
          </datalist>
          {error("numeroLote")}
        </label>
        <label className={styles.field} htmlFor={`${id}-fechaFabricacion`}>
          Fecha de fabricación
          <input
            {...field("fechaFabricacion")}
            type="date"
            required
            max={stockDate(new Date())}
            readOnly={!!existingLot?.fechaFabricacion}
            {...form.register("fechaFabricacion")}
          />
          {error("fechaFabricacion")}
        </label>
        <label className={styles.field} htmlFor={`${id}-fechaVencimiento`}>
          Fecha de vencimiento
          <input
            {...field("fechaVencimiento")}
            type="date"
            min={stockDate(new Date())}
            readOnly={!!existingLot}
            {...form.register("fechaVencimiento")}
          />
          {error("fechaVencimiento")}
        </label>
        <label className={styles.field} htmlFor={`${id}-ubicacionId`}>
          Ubicación
          <select
            {...field("ubicacionId")}
            {...form.register("ubicacionId", { valueAsNumber: true })}
          >
            {options.ubicaciones.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nombre} · {item.tipo === "BODEGA" ? "Bodega" : "Vitrina"}
              </option>
            ))}
            <option value={0}>Nueva ubicación</option>
          </select>
          {error("ubicacionId")}
        </label>
        <label className={styles.field} htmlFor={`${id}-cantidad`}>
          Cantidad a añadir
          <input
            {...field("cantidad")}
            type="number"
            min={1}
            max={2147483647}
            step={1}
            {...form.register("cantidad", { valueAsNumber: true })}
          />
          {error("cantidad")}
        </label>
        {locationId === 0 && (
          <>
            <label className={styles.field} htmlFor={`${id}-ubicacionNombre`}>
              Nombre de la ubicación
              <input
                {...field("ubicacionNombre")}
                maxLength={100}
                {...form.register("ubicacionNombre")}
              />
              {error("ubicacionNombre")}
            </label>
            <label className={styles.field} htmlFor={`${id}-ubicacionTipo`}>
              Tipo de ubicación
              <select
                {...field("ubicacionTipo")}
                {...form.register("ubicacionTipo")}
              >
                <option value="BODEGA">Bodega</option>
                <option value="VITRINA">Vitrina</option>
              </select>
              {error("ubicacionTipo")}
            </label>
          </>
        )}
      </div>
      {existingLot && (
        <p className={styles.note}>
          {existingLot.fechaFabricacion
            ? "Lote existente: se conservarán sus fechas y se sumará la cantidad indicada."
            : "Este lote no tiene fecha de fabricación registrada. Debes completarla para añadir stock."}
        </p>
      )}
      <label className={styles.field} htmlFor={`${id}-motivo`}>
        Motivo de entrada (opcional)
        <textarea
          {...field("motivo")}
          rows={2}
          maxLength={500}
          style={{ resize: "vertical" }}
          {...form.register("motivo")}
        />
        {error("motivo")}
      </label>
      {form.formState.errors.root && (
        <p className={styles.error} role="alert">
          {form.formState.errors.root.message}
        </p>
      )}
      <div className={styles.footer}>
        <Button
          variant="outline"
          disabled={mutation.isPending}
          onClick={onCancel}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending && <LoaderCircle size={16} />}
          {mutation.isPending ? "Guardando…" : "Añadir stock"}
        </Button>
      </div>
    </form>
  );
}

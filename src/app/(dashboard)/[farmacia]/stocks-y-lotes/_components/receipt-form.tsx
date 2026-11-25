"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import styles from "@/components/admin-table.module.css";
import { Button } from "@/components/ui/button";
import { receiptSchema } from "@/lib/types/fefo";
import type { StockOptions } from "@/lib/types/stock-y-lotes";
import { productsQueryKey } from "../../productos-y-empaques/actions";
import { stockOptionsQueryKey, stockQueryKey } from "../actions";
import { ProductSearch } from "./product-search";

export function ReceiptForm({
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
  const form = useForm<
    z.input<typeof receiptSchema>,
    unknown,
    z.output<typeof receiptSchema>
  >({
    resolver: zodResolver(receiptSchema),
    defaultValues: {
      medicamentoId: initialProductId,
      ubicacionId:
        options.ubicaciones.find((location) => location.sucursalId)?.id ?? 0,
      cantidad: 1,
      numeroLote: "",
      rotuloVencimiento: "",
      precisionVencimiento: "DIA",
      fechaFabricacion: "",
      fechaRecepcion: new Date().toISOString(),
      verificado: false,
      motivo: "Recepción de productos",
    },
  });
  const mutation = useMutation({
    mutationFn: async (body: z.output<typeof receiptSchema>) => {
      const response = await fetch("/api/privada/fefo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      return result as { pendiente: boolean };
    },
    onMutate: () => onSavingChange(true),
    onSuccess: async (result) => {
      await Promise.all(
        [
          stockQueryKey,
          stockOptionsQueryKey,
          productsQueryKey,
          ["fefo-control"],
        ].map((queryKey) => client.invalidateQueries({ queryKey })),
      );
      toast.success(
        result.pendiente
          ? "Recepción pendiente de revisión. No está disponible para venta."
          : "Recepción verificada registrada.",
      );
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
      onSubmit={form.handleSubmit((value) => mutation.mutate(value))}
    >
      <p className={styles.note}>
        Sin lote o vencimiento verificables, las unidades quedan pendientes. Los
        rótulos mes/año se conservan y no se habilitan para venta.
      </p>
      <div className={styles.fields}>
        <div className={styles.field}>
          <label htmlFor={`${id}-producto`}>Producto y presentación</label>
          <Controller
            control={form.control}
            name="medicamentoId"
            render={({ field }) => (
              <ProductSearch
                id={`${id}-producto`}
                products={options.productos}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                inputRef={field.ref}
                disabled={mutation.isPending}
                invalid={!!form.formState.errors.medicamentoId}
              />
            )}
          />
          {form.formState.errors.medicamentoId && (
            <span className={styles.error}>
              {form.formState.errors.medicamentoId.message}
            </span>
          )}
        </div>
        <label className={styles.field}>
          Ubicación / sucursal
          <select {...form.register("ubicacionId", { valueAsNumber: true })}>
            <option value={0}>Selecciona una ubicación</option>
            {options.ubicaciones
              .filter((location) => location.sucursalId)
              .map((location) => (
                <option key={location.id} value={location.id}>
                  {location.nombre} · Sucursal #{location.sucursalId}
                </option>
              ))}
          </select>
          <Link
            href="/privada/stocks-y-lotes/control-fefo"
            target="_blank"
            rel="noopener noreferrer"
          >
            Configurar sucursales y ubicaciones →
          </Link>
        </label>
        <label className={styles.field}>
          Número de lote
          <input
            {...form.register("numeroLote")}
            placeholder="Deja vacío si no se puede verificar"
          />
        </label>
        <label className={styles.field}>
          Precisión del rótulo
          <select {...form.register("precisionVencimiento")}>
            <option value="DIA">Día, mes y año</option>
            <option value="MES_ANIO">Solo mes y año — pendiente</option>
            <option value="NO_VERIFICADO">No verificable — pendiente</option>
          </select>
        </label>
        <label className={styles.field}>
          Vencimiento tal como aparece en el envase
          <input
            {...form.register("rotuloVencimiento")}
            placeholder="Ej. 25/12/2027 o 12/2027"
          />
        </label>
        <label className={styles.field}>
          Fecha de fabricación
          <input type="date" {...form.register("fechaFabricacion")} />
        </label>
        <label className={styles.field}>
          Fecha y hora de recepción
          <Controller
            control={form.control}
            name="fechaRecepcion"
            render={({ field }) => (
              <input
                type="datetime-local"
                value={
                  field.value
                    ? new Date(
                        new Date(field.value).getTime() -
                          new Date(field.value).getTimezoneOffset() * 60000,
                      )
                        .toISOString()
                        .slice(0, 16)
                    : ""
                }
                onBlur={field.onBlur}
                ref={field.ref}
                onChange={(event) =>
                  field.onChange(
                    event.target.value
                      ? new Date(event.target.value).toISOString()
                      : "",
                  )
                }
              />
            )}
          />
        </label>
        <label className={styles.field}>
          Cantidad
          <input
            type="number"
            min={1}
            step={1}
            {...form.register("cantidad", { valueAsNumber: true })}
          />
        </label>
      </div>
      <label className={styles.inline}>
        <input type="checkbox" {...form.register("verificado")} />
        Verifiqué físicamente el lote y el vencimiento del envase.
      </label>
      <label className={styles.field}>
        Motivo / documento de recepción
        <textarea rows={2} {...form.register("motivo")} />
      </label>
      {Object.entries(form.formState.errors).map(([key, value]) => (
        <p className={styles.error} role="alert" key={key}>
          {value?.message}
        </p>
      ))}
      <div className={styles.footer}>
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={mutation.isPending}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Registrando…" : "Registrar recepción"}
        </Button>
      </div>
    </form>
  );
}

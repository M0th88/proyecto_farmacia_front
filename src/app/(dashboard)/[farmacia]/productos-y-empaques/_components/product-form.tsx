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
import {
  chileFields,
  emptyChileFields,
  type ProductOptions,
  type ProductProfile,
  productProfileSchema,
  productTextFields,
  saleConditions,
} from "@/lib/types/productos";
import {
  stockOptionsQueryKey,
  stockQueryKey,
} from "../../stocks-y-lotes/actions";
import {
  productOptionsQueryKey,
  productsQueryKey,
  saveProduct,
} from "../actions";
import formStyles from "./product-form.module.css";

export function ProductForm({
  options,
  onSaved,
  onCancel,
  onSavingChange,
  product,
}: {
  options: ProductOptions;
  onSaved: () => void;
  onCancel: () => void;
  onSavingChange: (saving: boolean) => void;
  product?: { id: number; profile: ProductProfile };
}) {
  const pharmacy = usePharmacy();
  const id = useId();
  const client = useQueryClient();
  const router = useRouter();
  const form = useForm<ProductProfile>({
    resolver: zodResolver(productProfileSchema),
    mode: "onBlur",
    defaultValues: product?.profile ?? {
      nombre: "",
      codigoBarra: "",
      codigoCatalogo: "",
      codigoAtc: "",
      fuenteCatalogo: "",
      principioActivo: "",
      concentracion: "",
      formaFarmaceutica: "",
      precioVenta: "",
      condicionVenta: "SIN_CLASIFICAR",
      stockMinimo: 0,
      activo: true,
      categoriaId: 0,
      categoriaNombre: "",
      categoriaDescripcion: "",
      fichaChile: { ...emptyChileFields },
    },
  });
  const categoryId = useWatch({ control: form.control, name: "categoriaId" });
  const mutation = useMutation({
    mutationFn: (values: ProductProfile) =>
      saveProduct(pharmacy, {
        ...values,
        ...(product ? { id: product.id } : {}),
      }),
    onMutate: () => onSavingChange(true),
    onSuccess: async () => {
      await Promise.all(
        [
          productsQueryKey,
          productOptionsQueryKey,
          stockQueryKey,
          stockOptionsQueryKey,
        ].map((queryKey) => client.invalidateQueries({ queryKey })),
      );
      toast.success(product ? "Producto actualizado." : "Producto añadido.");
      onSaved();
      router.refresh();
    },
    onError: (error) => {
      form.setError("root", { message: error.message });
      toast.error(error.message);
    },
    onSettled: () => onSavingChange(false),
  });
  const field = (name: keyof ProductProfile) => ({
    id: `${id}-${name}`,
    disabled: mutation.isPending,
    "aria-invalid": !!form.formState.errors[name],
    "aria-describedby": form.formState.errors[name]
      ? `${id}-${name}-error`
      : undefined,
  });
  const error = (name: Exclude<keyof ProductProfile, "fichaChile">) =>
    form.formState.errors[name] ? (
      <span id={`${id}-${name}-error`} className={styles.error}>
        {form.formState.errors[name]?.message}
      </span>
    ) : null;
  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
      aria-busy={mutation.isPending}
    >
      <div className={styles.fields}>
        {productTextFields.map((item) => (
          <label
            className={styles.field}
            htmlFor={`${id}-${item.name}`}
            key={item.name}
          >
            {item.label}
            {item.name !== "nombre" && " (opcional)"}
            <input
              {...field(item.name)}
              {...form.register(item.name)}
              maxLength={item.max}
              required={item.name === "nombre"}
            />
            {error(item.name)}
          </label>
        ))}
        <label className={styles.field} htmlFor={`${id}-categoriaId`}>
          Categoría
          <select
            {...field("categoriaId")}
            {...form.register("categoriaId", { valueAsNumber: true })}
          >
            <option value={0}>Sin categoría</option>
            {options.categorias.map((category) => (
              <option key={category.id} value={category.id}>
                {category.nombre}
              </option>
            ))}
            <option value={-1}>Nueva categoría</option>
          </select>
          {error("categoriaId")}
        </label>
        <label className={styles.field} htmlFor={`${id}-condicionVenta`}>
          Condición de venta
          <select
            {...field("condicionVenta")}
            {...form.register("condicionVenta")}
          >
            {saleConditions.map((condition) => (
              <option key={condition.value} value={condition.value}>
                {condition.label}
              </option>
            ))}
          </select>
          {error("condicionVenta")}
        </label>
        {categoryId === -1 && (
          <>
            <label className={styles.field} htmlFor={`${id}-categoriaNombre`}>
              Nombre de la categoría
              <input
                {...field("categoriaNombre")}
                {...form.register("categoriaNombre")}
                maxLength={100}
              />
              {error("categoriaNombre")}
            </label>
            <label
              className={styles.field}
              htmlFor={`${id}-categoriaDescripcion`}
            >
              Descripción de la categoría (opcional)
              <input
                {...field("categoriaDescripcion")}
                {...form.register("categoriaDescripcion")}
                maxLength={500}
              />
              {error("categoriaDescripcion")}
            </label>
          </>
        )}
        <label className={styles.field} htmlFor={`${id}-precioVenta`}>
          Precio de venta en CLP (opcional)
          <input
            {...field("precioVenta")}
            inputMode="decimal"
            placeholder="Ej. 2500"
            {...form.register("precioVenta")}
          />
          <small>Deja vacío si el precio está pendiente.</small>
          {error("precioVenta")}
        </label>
        <label className={styles.field} htmlFor={`${id}-stockMinimo`}>
          Stock mínimo
          <input
            {...field("stockMinimo")}
            type="number"
            min={0}
            max={2147483647}
            step={1}
            {...form.register("stockMinimo", { valueAsNumber: true })}
          />
          {error("stockMinimo")}
        </label>
        <label className={styles.inline}>
          <input
            type="checkbox"
            {...form.register("activo")}
            disabled={mutation.isPending}
          />
          Producto activo
        </label>
      </div>
      <details
        className={formStyles.details}
        onToggle={(event) => {
          if (Object.keys(form.formState.errors.fichaChile ?? {}).length)
            event.currentTarget.open = true;
        }}
      >
        <summary>Ficha del medicamento en Chile (opcional)</summary>
        <div className={styles.fields}>
          {chileFields.map((item) => (
            <label
              key={item.name}
              className={styles.field}
              htmlFor={`${id}-ficha-${item.name}`}
            >
              {item.label}
              <textarea
                id={`${id}-ficha-${item.name}`}
                rows={2}
                maxLength={2000}
                style={{ resize: "vertical" }}
                {...form.register(`fichaChile.${item.name}`)}
                disabled={mutation.isPending}
                aria-invalid={!!form.formState.errors.fichaChile?.[item.name]}
                aria-describedby={
                  form.formState.errors.fichaChile?.[item.name]
                    ? `${id}-ficha-${item.name}-error`
                    : undefined
                }
              />
              {form.formState.errors.fichaChile?.[item.name] && (
                <span
                  id={`${id}-ficha-${item.name}-error`}
                  className={styles.error}
                >
                  {form.formState.errors.fichaChile[item.name]?.message}
                </span>
              )}
            </label>
          ))}
        </div>
      </details>
      {form.formState.errors.fichaChile && (
        <p role="alert" className={styles.error}>
          Revisa los campos de la ficha del medicamento en Chile.
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
            : product
              ? "Guardar cambios"
              : "Añadir producto"}
        </Button>
      </div>
    </form>
  );
}

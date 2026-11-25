"use client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { usePharmacy } from "@/components/pharmacy-provider";
import { RecordDetails } from "@/components/record-details";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import {
  chileFields,
  productTextFields,
  saleConditions,
} from "@/lib/types/productos";
import { getProduct, productOptions, productsQueryKey } from "../actions";
import { ProductForm } from "./product-form";

export function ProductRecordDialog({
  id,
  editing,
  currentUserId,
  onClose,
}: {
  id: number;
  editing: boolean;
  currentUserId: number;
  onClose: () => void;
}) {
  const pharmacy = usePharmacy();
  const [saving, setSaving] = useState(false);
  const query = useQuery({
    queryKey: [...productsQueryKey, "detail", currentUserId, id],
    queryFn: async () => {
      const [product, options] = await Promise.all([
        getProduct(pharmacy, id),
        productOptions(pharmacy),
      ]);
      return { product, options };
    },
  });
  const profile = query.data?.product.profile;
  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
      title={editing ? "Editar producto" : "Detalle del producto"}
      description={
        editing
          ? "Actualiza los datos del producto y su ficha."
          : "Datos registrados del producto."
      }
    >
      {query.isPending ? (
        <Skeleton style={{ height: 300 }} />
      ) : query.isError ? (
        <div role="alert">
          <p>{query.error.message}</p>
          <Button onClick={() => void query.refetch()}>Reintentar</Button>
        </div>
      ) : (
        profile &&
        (editing ? (
          <ProductForm
            product={query.data.product}
            options={query.data.options}
            onSaved={onClose}
            onCancel={onClose}
            onSavingChange={setSaving}
          />
        ) : (
          <>
            <RecordDetails
              fields={{
                ID: id,
                ...Object.fromEntries(
                  productTextFields.map((field) => [
                    field.label,
                    profile[field.name] || "—",
                  ]),
                ),
                Categoría:
                  query.data.options.categorias.find(
                    (category) => category.id === profile.categoriaId,
                  )?.nombre ?? "Sin categoría",
                "Condición de venta": saleConditions.find(
                  (condition) => condition.value === profile.condicionVenta,
                )?.label,
                "Precio de venta (CLP)": profile.precioVenta || "Pendiente",
                "Stock mínimo": profile.stockMinimo,
                Estado: profile.activo ? "Activo" : "Inactivo",
                ...Object.fromEntries(
                  chileFields.map((field) => [
                    field.label,
                    profile.fichaChile[field.name] || "—",
                  ]),
                ),
                Creado: new Date(query.data.product.creadoEn).toLocaleString(
                  "es-CL",
                  { timeZone: "America/Santiago" },
                ),
                Actualizado: new Date(
                  query.data.product.actualizadoEn,
                ).toLocaleString("es-CL", { timeZone: "America/Santiago" }),
              }}
            />
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
          </>
        ))
      )}
    </Modal>
  );
}

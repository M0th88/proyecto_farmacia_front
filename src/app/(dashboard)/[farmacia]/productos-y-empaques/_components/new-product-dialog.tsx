"use client";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { usePharmacy } from "@/components/pharmacy-provider";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { productOptions, productOptionsQueryKey } from "../actions";
import { ProductForm } from "./product-form";

export function NewProductDialog({
  currentUserId,
  otros = false,
}: {
  currentUserId: number;
  otros?: boolean;
}) {
  const pharmacy = usePharmacy();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const options = useQuery({
    queryKey: [...productOptionsQueryKey, currentUserId],
    queryFn: productOptions.bind(null, pharmacy),
    enabled: open,
  });
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        Añadir productos
        <Plus size={16} />
      </Button>
      <Modal
        open={open}
        onOpenChange={(value) => {
          if (!saving) setOpen(value);
        }}
        title="Añadir producto"
        description="Ingresa los datos del producto, su precio y su clasificación."
      >
        {options.isPending ? (
          <Skeleton style={{ height: 300 }} />
        ) : options.isError ? (
          <div role="alert">
            <p>{options.error.message}</p>
            <Button variant="outline" onClick={() => void options.refetch()}>
              Reintentar
            </Button>
          </div>
        ) : (
          <ProductForm
            options={options.data}
            otros={otros}
            onSaved={() => setOpen(false)}
            onCancel={() => setOpen(false)}
            onSavingChange={setSaving}
          />
        )}
      </Modal>
    </>
  );
}

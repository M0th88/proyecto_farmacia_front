"use client";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { usePharmacy } from "@/components/pharmacy-provider";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { stockOptions, stockOptionsQueryKey } from "../actions";
import { ReceiptForm } from "./receipt-form";
import { StockForm } from "./stock-form";

export function NewStockDialog({ currentUserId }: { currentUserId: number }) {
  const pharmacy = usePharmacy();
  const EntryForm = pharmacy === "privada" ? ReceiptForm : StockForm;
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const options = useQuery({
    queryKey: [...stockOptionsQueryKey, currentUserId],
    queryFn: stockOptions.bind(null, pharmacy),
    enabled: open,
  });
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        Añadir stock
        <Plus size={16} />
      </Button>
      <Modal
        open={open}
        onOpenChange={(value) => {
          if (!saving) setOpen(value);
        }}
        title="Añadir stock"
        description="Selecciona el producto e ingresa el lote, la ubicación y la cantidad que recibes."
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
        ) : !options.data.productos.length ? (
          <p>
            No hay productos activos. Registra un producto antes de añadir
            stock.
          </p>
        ) : (
          <EntryForm
            options={options.data}
            onSaved={() => setOpen(false)}
            onCancel={() => setOpen(false)}
            onSavingChange={setSaving}
          />
        )}
      </Modal>
    </>
  );
}

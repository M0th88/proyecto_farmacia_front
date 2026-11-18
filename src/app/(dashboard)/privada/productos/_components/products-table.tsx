"use client";
import { useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "@/components/admin-table.module.css";
import { DataTable } from "@/components/data-table";
import { DeleteRecordDialog } from "@/components/delete-record-dialog";
import { RecordActions } from "@/components/record-actions";
import {
  type ProductMetrics as Metrics,
  type ProductRow,
  saleConditions,
} from "@/lib/types/productos";
import {
  stockOptionsQueryKey,
  stockQueryKey,
} from "../../stock-y-lotes/actions";
import {
  listProducts,
  type ProductPage,
  productsQueryKey,
  removeProduct,
} from "../actions";
import { NewProductDialog } from "./new-product-dialog";
import { ProductMetrics } from "./product-metrics";
import { ProductRecordDialog } from "./product-record-dialog";

export const productHeaders = [
  "Estado",
  "ID",
  "Producto",
  "Código de barras",
  "Código de catálogo",
  "Categoría",
  "Principio activo",
  "Concentración",
  "Forma farmacéutica",
  "Condición de venta",
  "Precio venta",
  "Código ATC",
  "Fuente del catálogo",
] as const;
const columns: ColumnDef<ProductRow>[] = [
  {
    accessorKey: "activo",
    header: "Estado",
    size: 110,
    cell: ({ getValue }) => (
      <span className={styles.badge}>
        {getValue<boolean>() ? "Activo" : "Inactivo"}
      </span>
    ),
  },
  { accessorKey: "id", header: "ID", size: 70 },
  { accessorKey: "nombre", header: "Producto", size: 300 },
  ...(
    [
      ["codigoBarra", "Código de barras", 160],
      ["codigoCatalogo", "Código de catálogo", 170],
      ["categoria", "Categoría", 180],
      ["principioActivo", "Principio activo", 220],
      ["concentracion", "Concentración", 170],
      ["formaFarmaceutica", "Forma farmacéutica", 190],
    ] as const
  ).map(([accessorKey, header, size]) => ({
    accessorKey,
    header,
    size,
    cell: ({ getValue }: { getValue: () => unknown }) =>
      String(getValue() || "—"),
  })),
  {
    accessorKey: "condicionVenta",
    header: "Condición de venta",
    size: 190,
    cell: ({ getValue }) => (
      <span className={styles.badge}>
        {saleConditions.find(
          (condition) => condition.value === getValue<string>(),
        )?.label ?? getValue<string>()}
      </span>
    ),
  },
  {
    accessorKey: "precioVenta",
    header: "Precio venta",
    size: 140,
    cell: ({ getValue }) => {
      const price = getValue<number | null>();
      return price === null
        ? "Pendiente"
        : new Intl.NumberFormat("es-CL", {
            style: "currency",
            currency: "CLP",
            maximumFractionDigits: 0,
          }).format(price);
    },
  },
  {
    accessorKey: "codigoAtc",
    header: "Código ATC",
    size: 130,
    cell: ({ getValue }) => getValue<string>() || "—",
  },
  {
    accessorKey: "fuenteCatalogo",
    header: "Fuente del catálogo",
    size: 240,
    cell: ({ getValue }) => getValue<string>() || "—",
  },
];
export function ProductsTable({
  currentUserId,
  initialMetrics,
  isAdmin,
}: {
  currentUserId: number;
  initialMetrics: Metrics;
  isAdmin: boolean;
}) {
  const [selected, setSelected] = useState<{
    id: number;
    editing: boolean;
  } | null>(null);
  const [deleted, setDeleted] = useState<ProductRow | null>(null);
  const client = useQueryClient();
  const router = useRouter();
  const actionColumns: ColumnDef<ProductRow>[] = [
    ...columns,
    {
      id: "acciones",
      header: "Acciones",
      enableSorting: false,
      size: 100,
      cell: ({ row }) => (
        <RecordActions
          name={row.original.nombre}
          canDelete={isAdmin}
          onView={() => setSelected({ id: row.original.id, editing: false })}
          onEdit={() => setSelected({ id: row.original.id, editing: true })}
          onDelete={() => setDeleted(row.original)}
        />
      ),
    },
  ];
  return (
    <section className={styles.page}>
      <h1 className={styles.title}>Productos</h1>
      <DataTable<ProductRow>
        columns={actionColumns}
        queryKey={[...productsQueryKey, currentUserId]}
        queryFn={listProducts}
        entityLabel="productos"
        placeholder="Filtrar por nombre, código, categoría o principio activo"
        emptyTitle="No hay productos registrados. Añade un producto para comenzar."
        createButton={<NewProductDialog currentUserId={currentUserId} />}
        getRowId={(product) => String(product.id)}
        renderSummary={(page) => (
          <ProductMetrics
            metrics={
              (page as ProductPage | undefined)?.metrics ?? initialMetrics
            }
          />
        )}
      />
      {selected && (
        <ProductRecordDialog
          key={`${selected.id}-${selected.editing}`}
          id={selected.id}
          editing={selected.editing}
          currentUserId={currentUserId}
          onClose={() => setSelected(null)}
        />
      )}
      {deleted && (
        <DeleteRecordDialog
          open
          title="Eliminar producto"
          description={`¿Eliminar ${deleted.nombre}? Solo se pueden eliminar productos sin lotes ni ventas. Esta acción es permanente.`}
          onClose={() => setDeleted(null)}
          onDelete={async () => {
            await removeProduct(deleted.id);
            await Promise.all(
              [productsQueryKey, stockQueryKey, stockOptionsQueryKey].map(
                (queryKey) => client.invalidateQueries({ queryKey }),
              ),
            );
            router.refresh();
          }}
        />
      )}
    </section>
  );
}

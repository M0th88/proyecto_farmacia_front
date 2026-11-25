"use client";
import type { ColumnDef } from "@tanstack/react-table";
import { useState } from "react";
import styles from "@/components/admin-table.module.css";
import { DataTable } from "@/components/data-table";
import { usePharmacy } from "@/components/pharmacy-provider";
import { RecordActions } from "@/components/record-actions";
import { stockDate } from "@/lib/private/stock-dates";
import type {
  StockMetrics as Metrics,
  StockRow,
} from "@/lib/types/stock-y-lotes";
import { listStock, type StockPage, stockQueryKey } from "../actions";
import { NewStockDialog } from "./new-stock-dialog";
import { StockMetrics } from "./stock-metrics";
import { StockRecordDialog } from "./stock-record-dialog";
import statusStyles from "./stock-status.module.css";

const formatDate = (value: string | null) =>
  value ? stockDate(new Date(value)).split("-").reverse().join("/") : "—";
const columns: ColumnDef<StockRow>[] = [
  {
    accessorKey: "estado",
    header: "Estado",
    size: 170,
    cell: ({ row }) => (
      <span
        className={`${styles.badge} ${row.original.estado === "Vencido" || (row.original.diasParaVencer !== null && row.original.diasParaVencer <= 1) ? statusStyles.expired : row.original.diasParaVencer !== null && row.original.diasParaVencer <= 7 ? statusStyles.warning : ""}`}
      >
        {row.original.estado}
      </span>
    ),
  },
  { accessorKey: "nombre", header: "Producto", size: 300 },
  {
    accessorKey: "codigo",
    header: "Código de barras",
    size: 170,
    cell: ({ getValue }) => getValue<string>() || "—",
  },
  {
    accessorKey: "numeroLote",
    header: "Lote",
    size: 150,
    cell: ({ getValue }) => getValue<string>() || "Sin lotes",
  },
  {
    accessorKey: "fechaFabricacion",
    header: "Fabricación",
    size: 140,
    cell: ({ getValue }) => formatDate(getValue<string | null>()),
  },
  {
    accessorKey: "fechaVencimiento",
    header: "Vencimiento",
    size: 150,
    cell: ({ getValue }) => formatDate(getValue<string | null>()),
  },
  {
    accessorKey: "ubicacion",
    header: "Ubicación",
    size: 180,
    cell: ({ getValue }) => getValue<string>() || "—",
  },
  { accessorKey: "cantidad", header: "Stock", size: 100 },
  { accessorKey: "minimo", header: "Stock mínimo", size: 140 },
  {
    accessorKey: "precio",
    header: "Precio",
    size: 130,
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
  { accessorKey: "condicion", header: "Condición de venta", size: 210 },
];

export function StockTable({
  currentUserId,
  initialMetrics,
}: {
  currentUserId: number;
  initialMetrics: Metrics;
}) {
  const pharmacy = usePharmacy();
  const [selected, setSelected] = useState<{
    row: StockRow;
    editing: boolean;
  } | null>(null);
  const actionColumns: ColumnDef<StockRow>[] = [
    ...columns,
    {
      id: "acciones",
      header: "Acciones",
      enableSorting: false,
      size: 100,
      cell: ({ row }) => (
        <RecordActions
          name={row.original.nombre}
          canDelete={false}
          onView={() => setSelected({ row: row.original, editing: false })}
          onEdit={() => setSelected({ row: row.original, editing: true })}
          onDelete={() => {}}
        />
      ),
    },
  ];
  return (
    <section className={styles.page}>
      <h1 className={styles.title}>Stocks y Lotes</h1>
      <DataTable<StockRow>
        columns={actionColumns}
        queryKey={[...stockQueryKey, currentUserId]}
        queryFn={listStock.bind(null, pharmacy)}
        entityLabel="registros de stock"
        placeholder="Filtrar por producto, código, lote, ubicación o estado"
        emptyTitle="No hay productos registrados para gestionar stock."
        createButton={<NewStockDialog currentUserId={currentUserId} />}
        getRowId={(row) => row.id}
        renderSummary={(page) => (
          <StockMetrics
            metrics={(page as StockPage | undefined)?.metrics ?? initialMetrics}
          />
        )}
      />
      {selected && (
        <StockRecordDialog
          key={`${selected.row.id}-${selected.editing}`}
          row={selected.row}
          editing={selected.editing}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}

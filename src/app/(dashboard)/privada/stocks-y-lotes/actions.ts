import type { SortingState } from "@tanstack/react-table";
import type { PaginationResponse } from "@/lib/types/pagination";
import type {
  StockEdit,
  StockEntry,
  StockMetrics,
  StockOptions,
  StockRow,
} from "@/lib/types/stock-y-lotes";

export const stockQueryKey = ["private-stock"] as const;
export const stockOptionsQueryKey = ["private-stock-options"] as const;
export type StockPage = PaginationResponse<StockRow> & {
  metrics: StockMetrics;
};
async function request<T>(params = "", options?: RequestInit): Promise<T> {
  const response = await fetch(`/api/privada/stock-y-lotes${params}`, {
    cache: "no-store",
    ...options,
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error ?? "No se pudo completar la solicitud.");
  return data;
}
export function listStock({
  pageParam,
  search,
  sorting,
  signal,
}: {
  pageParam: number;
  search: string;
  sorting: SortingState;
  signal?: AbortSignal;
}) {
  const params = new URLSearchParams({
    page: String(pageParam),
    search,
    sort: sorting[0]?.id ?? "nombre",
    direction: sorting[0]?.desc ? "desc" : "asc",
  });
  return request<StockPage>(`?${params}`, { signal });
}
export const stockOptions = () => request<StockOptions>("?opciones=1");
export const saveStock = (input: StockEntry) =>
  request<{ id: number; cantidad: number }>("", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
export const updateStock = (input: StockEdit) =>
  request<{ success: boolean }>("", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

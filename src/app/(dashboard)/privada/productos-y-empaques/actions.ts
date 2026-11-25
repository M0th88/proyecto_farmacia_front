import type { SortingState } from "@tanstack/react-table";
import type { PaginationResponse } from "@/lib/types/pagination";
import type {
  ProductDetail,
  ProductMetrics,
  ProductOptions,
  ProductProfile,
  ProductRow,
} from "@/lib/types/productos";

export const productsQueryKey = ["private-products"] as const;
export const productOptionsQueryKey = ["private-product-options"] as const;
export type ProductPage = PaginationResponse<ProductRow> & {
  metrics: ProductMetrics;
};
async function request<T>(params = "", options?: RequestInit): Promise<T> {
  const response = await fetch(`/api/privada/productos${params}`, {
    cache: "no-store",
    ...options,
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error ?? "No se pudo completar la solicitud.");
  return data;
}
export function listProducts({
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
  return request<ProductPage>(
    `?${new URLSearchParams({ page: String(pageParam), search, sort: sorting[0]?.id ?? "nombre", direction: sorting[0]?.desc ? "desc" : "asc" })}`,
    { signal },
  );
}
export const productOptions = () => request<ProductOptions>("?opciones=1");
export const saveProduct = (profile: ProductProfile & { id?: number }) =>
  request<{ id: number; nombre: string }>("", {
    method: profile.id ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile),
  });
export const getProduct = (id: number) => request<ProductDetail>(`?id=${id}`);
export const removeProduct = (id: number) =>
  request<{ success: boolean }>("", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });

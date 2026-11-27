import type { SortingState } from "@tanstack/react-table";
import type { Pharmacy } from "@/lib/auth/pharmacies";
import type { PaginationResponse } from "@/lib/types/pagination";
import type {
  ProductDetail,
  ProductLabel,
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
async function request<T>(
  pharmacy: Pharmacy,
  params = "",
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`/api/${pharmacy}/productos${params}`, {
    cache: "no-store",
    ...options,
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error ?? "No se pudo completar la solicitud.");
  return data;
}
export function listProducts(
  pharmacy: Pharmacy,
  {
    pageParam,
    search,
    sorting,
    signal,
  }: {
    pageParam: number;
    search: string;
    sorting: SortingState;
    signal?: AbortSignal;
  },
  otros = false,
) {
  return request<ProductPage>(
    pharmacy,
    `?${new URLSearchParams({ page: String(pageParam), search, sort: sorting[0]?.id ?? "nombre", direction: sorting[0]?.desc ? "desc" : "asc", ...(otros && { otros: "1" }) })}`,
    { signal },
  );
}
export const productOptions = (pharmacy: Pharmacy) =>
  request<ProductOptions>(pharmacy, "?opciones=1");
export const saveProduct = (
  pharmacy: Pharmacy,
  profile: ProductProfile & { id?: number },
  otros = false,
) =>
  request<{ id: number; nombre: string }>(pharmacy, otros ? "?otros=1" : "", {
    method: profile.id ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile),
  });
export const getProduct = (pharmacy: Pharmacy, id: number) =>
  request<ProductDetail>(pharmacy, `?id=${id}`);
export const removeProduct = (pharmacy: Pharmacy, id: number) =>
  request<{ success: boolean }>(pharmacy, "", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });

export const getProductLabel = (pharmacy: Pharmacy, id: number) =>
  request<ProductLabel>(pharmacy, `?id=${id}&etiqueta=1`);
export const generateProductBarcode = (pharmacy: Pharmacy, id: number) =>
  request<ProductLabel>(pharmacy, "?etiqueta=1", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });

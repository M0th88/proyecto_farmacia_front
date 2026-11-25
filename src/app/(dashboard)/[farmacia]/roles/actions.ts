import type { SortingState } from "@tanstack/react-table";
import type { Pharmacy } from "@/lib/auth/pharmacies";
import type { PaginationResponse } from "@/lib/types/pagination";
import type { RoleProfile } from "@/lib/types/roles";
import type { Role } from "@/lib/types/usuarios-y-roles";

export const rolesTableQueryKey = ["private-roles", "table"] as const;

async function request<T>(
  pharmacy: Pharmacy,
  options?: RequestInit,
  params = "",
): Promise<T> {
  const response = await fetch(`/api/${pharmacy}/admin/roles${params}`, {
    cache: "no-store",
    ...options,
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error ?? "No se pudo completar la solicitud.");
  return data;
}

export function listRolesPage(
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
) {
  const params = new URLSearchParams({
    page: String(pageParam),
    pageSize: "30",
    search,
    sort: sorting[0]?.id ?? "nombre",
    direction: sorting[0]?.desc ? "desc" : "asc",
  });
  return request<PaginationResponse<Role>>(pharmacy, { signal }, `?${params}`);
}

export function saveRole(
  pharmacy: Pharmacy,
  profile: RoleProfile & { id?: number },
) {
  return request<Role>(pharmacy, {
    method: profile.id ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile),
  });
}

export function deleteRole(pharmacy: Pharmacy, id: number) {
  return request<{ success: boolean }>(pharmacy, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
}

import type { SortingState } from "@tanstack/react-table";
import type { PaginationResponse } from "@/lib/types/pagination";
import type { Role, User, UserProfile } from "@/lib/types/usuarios-y-roles";

export const usersQueryKey = ["private-users"] as const;
export const rolesQueryKey = ["private-roles"] as const;
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...options });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error ?? "No se pudo completar la solicitud.");
  return data;
}
export function listUsers({
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
    pageSize: "30",
    search,
    sort: sorting[0]?.id ?? "nombre",
    direction: sorting[0]?.desc ? "desc" : "asc",
  });
  return request<PaginationResponse<User>>(
    `/api/privada/admin/usuarios?${params}`,
    { signal },
  );
}
export const listRoles = () => request<Role[]>("/api/privada/admin/roles");
export function saveUser(profile: Partial<UserProfile> & { id?: number }) {
  return request<User>("/api/privada/admin/usuarios", {
    method: profile.id ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile),
  });
}
export function deleteUser(id: number) {
  return request<{ success: boolean }>("/api/privada/admin/usuarios", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
}

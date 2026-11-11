import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requirePharmacyUser } from "@/lib/auth/session";
import { listUsersPage, userListSchema } from "@/lib/private/users";
import { getQueryClient } from "@/lib/query-client";
import type { PaginationResponse } from "@/lib/types/pagination";
import type { User } from "@/lib/types/usuarios-y-roles";
import { UsersTableSkeleton } from "./_components/table-skeleton";
import { UsersTable } from "./_components/users-table";
import { usersQueryKey } from "./actions";

export const instant = false;
async function UsersContent() {
  const user = await requirePharmacyUser("privada");
  if (user.rol.nombre !== "Administrador") redirect("/privada/sin-acceso");
  const queryClient = getQueryClient();
  await queryClient.prefetchInfiniteQuery({
    queryKey: [...usersQueryKey, user.id, "", []],
    queryFn: ({ pageParam }) =>
      listUsersPage(userListSchema.parse({ page: pageParam })),
    initialPageParam: 0,
    getNextPageParam: (page: PaginationResponse<User>) =>
      page.nextPage ?? undefined,
  });
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <UsersTable currentUserId={user.id} />
    </HydrationBoundary>
  );
}
export default function UsuariosRolesPage() {
  return (
    <Suspense fallback={<UsersTableSkeleton />}>
      <UsersContent />
    </Suspense>
  );
}

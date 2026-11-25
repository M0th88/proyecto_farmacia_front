import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import {
  type PharmacyParams,
  resolvePharmacy,
} from "@/lib/auth/pharmacy-scope";
import { requirePharmacyUser } from "@/lib/auth/session";
import { pharmacyDb } from "@/lib/db/pharmacy-db";
import { listUsersPage, userListSchema } from "@/lib/private/users";
import { getQueryClient } from "@/lib/query-client";
import type { PaginationResponse } from "@/lib/types/pagination";
import type { User } from "@/lib/types/usuarios-y-roles";
import { UsersTableSkeleton } from "./_components/table-skeleton";
import { UsersTable } from "./_components/users-table";
import { usersQueryKey } from "./actions";

export const instant = false;
async function UsersContent({ params }: PharmacyParams) {
  const pharmacy = await resolvePharmacy(params);
  const user = await requirePharmacyUser(pharmacy);
  if (user.rol.nombre !== "Administrador") redirect(`/${pharmacy}/sin-acceso`);
  const queryClient = getQueryClient();
  await queryClient.prefetchInfiniteQuery({
    queryKey: [...usersQueryKey, user.id, "", []],
    queryFn: ({ pageParam }) =>
      listUsersPage(
        userListSchema.parse({ page: pageParam }),
        pharmacyDb(pharmacy),
      ),
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
export default function UsuariosRolesPage({ params }: PharmacyParams) {
  return (
    <Suspense fallback={<UsersTableSkeleton />}>
      <UsersContent params={params} />
    </Suspense>
  );
}

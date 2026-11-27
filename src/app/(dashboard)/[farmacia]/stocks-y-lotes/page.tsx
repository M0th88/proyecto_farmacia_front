import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import {
  type PharmacyParams,
  resolvePharmacy,
} from "@/lib/auth/pharmacy-scope";
import { getPharmacyUser } from "@/lib/auth/session";
import { pharmacyDb } from "@/lib/db/pharmacy-db";
import {
  paginateStock,
  stockListSchema,
  stockSnapshot,
} from "@/lib/private/stock";
import { getQueryClient } from "@/lib/query-client";
import { StockTable } from "./_components/stock-table";
import { stockQueryKey } from "./actions";
import StockLoading from "./loading";

export const instant = false;
async function StockContent({ params }: PharmacyParams) {
  const pharmacy = await resolvePharmacy(params);
  const user = await getPharmacyUser(pharmacy);
  if (!user) redirect(`/login/${pharmacy}`);
  if (
    user.rol.nombre !== "Administrador" &&
    !user.rol.permisos.includes("inventario")
  )
    redirect(`/${pharmacy}/sin-acceso`);
  const snapshot = await stockSnapshot(
    pharmacy === "asistencial" ? pharmacyDb(pharmacy) : undefined,
  );
  const queryClient = getQueryClient();
  queryClient.setQueryData([...stockQueryKey, user.id, "", []], {
    pages: [
      {
        ...paginateStock(snapshot.rows, stockListSchema.parse({})),
        metrics: snapshot.metrics,
      },
    ],
    pageParams: [0],
  });
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <StockTable currentUserId={user.id} initialMetrics={snapshot.metrics} />
    </HydrationBoundary>
  );
}
export default function StockLotesPage({ params }: PharmacyParams) {
  return (
    <Suspense fallback={<StockLoading />}>
      <StockContent params={params} />
    </Suspense>
  );
}

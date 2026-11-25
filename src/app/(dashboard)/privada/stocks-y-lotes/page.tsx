import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getPrivateUser } from "@/lib/auth/session";
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
async function StockContent() {
  const user = await getPrivateUser();
  if (!user) redirect("/login/privada");
  if (
    user.rol.nombre !== "Administrador" &&
    !user.rol.permisos.includes("inventario")
  )
    redirect("/privada/sin-acceso");
  const snapshot = await stockSnapshot();
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
      <Link href="/privada/stocks-y-lotes/control-fefo">
        Control FEFO: conciliación, alertas y devoluciones →
      </Link>
      <StockTable currentUserId={user.id} initialMetrics={snapshot.metrics} />
    </HydrationBoundary>
  );
}
export default function StockLotesPage() {
  return (
    <Suspense fallback={<StockLoading />}>
      <StockContent />
    </Suspense>
  );
}

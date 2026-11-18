import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getPrivateUser } from "@/lib/auth/session";
import {
  paginateProducts,
  productListSchema,
  productSnapshot,
} from "@/lib/private/products";
import { getQueryClient } from "@/lib/query-client";
import { ProductsTable } from "./_components/products-table";
import { productsQueryKey } from "./actions";
import ProductsLoading from "./loading";

export const instant = false;
async function ProductsContent() {
  const user = await getPrivateUser();
  if (!user) redirect("/login/privada");
  if (
    user.rol.nombre !== "Administrador" &&
    !user.rol.permisos.includes("catalogo")
  )
    redirect("/privada/sin-acceso");
  const snapshot = await productSnapshot();
  const client = getQueryClient();
  client.setQueryData([...productsQueryKey, user.id, "", []], {
    pages: [
      {
        ...paginateProducts(snapshot.rows, productListSchema.parse({})),
        metrics: snapshot.metrics,
      },
    ],
    pageParams: [0],
  });
  return (
    <HydrationBoundary state={dehydrate(client)}>
      <ProductsTable
        currentUserId={user.id}
        isAdmin={user.rol.nombre === "Administrador"}
        initialMetrics={snapshot.metrics}
      />
    </HydrationBoundary>
  );
}
export default function ProductosPage() {
  return (
    <Suspense fallback={<ProductsLoading />}>
      <ProductsContent />
    </Suspense>
  );
}

import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { Suspense } from "react";
import { requirePharmacySection } from "@/lib/auth/pharmacy-permissions";
import {
  type PharmacyParams,
  resolvePharmacy,
} from "@/lib/auth/pharmacy-scope";
import { pharmacyDb } from "@/lib/db/pharmacy-db";
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
async function ProductsContent({ params }: PharmacyParams) {
  const pharmacy = await resolvePharmacy(params);
  const user = await requirePharmacySection(pharmacy, "/productos-y-empaques");
  const snapshot = await productSnapshot(pharmacyDb(pharmacy));
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
export default function ProductosPage({ params }: PharmacyParams) {
  return (
    <Suspense fallback={<ProductsLoading />}>
      <ProductsContent params={params} />
    </Suspense>
  );
}

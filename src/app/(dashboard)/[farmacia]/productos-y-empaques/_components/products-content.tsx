import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { redirect } from "next/navigation";
import {
  type PharmacyParams,
  resolvePharmacy,
} from "@/lib/auth/pharmacy-scope";
import { getPharmacyUser } from "@/lib/auth/session";
import { pharmacyDb } from "@/lib/db/pharmacy-db";
import { canOperate } from "@/lib/fefo";
import {
  paginateProducts,
  productListSchema,
  productSnapshot,
} from "@/lib/private/products";
import { getQueryClient } from "@/lib/query-client";
import { productsQueryKey } from "../actions";
import { ProductsTable } from "./products-table";

export async function ProductsContent({
  params,
  otros = false,
}: PharmacyParams & { otros?: boolean }) {
  const pharmacy = await resolvePharmacy(params);
  const user = await getPharmacyUser(pharmacy);
  if (!user) redirect(`/login/${pharmacy}`);
  if (!canOperate(user, "catalogo")) redirect(`/${pharmacy}/sin-acceso`);

  const snapshot = await productSnapshot(pharmacyDb(pharmacy), otros);
  const client = getQueryClient();
  const queryKey = otros
    ? [...productsQueryKey, "otros", pharmacy, user.id]
    : [...productsQueryKey, user.id];
  client.setQueryData([...queryKey, "", []], {
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
        otros={otros}
      />
    </HydrationBoundary>
  );
}

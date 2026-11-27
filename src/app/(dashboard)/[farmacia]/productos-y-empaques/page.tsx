import { Suspense } from "react";
import type { PharmacyParams } from "@/lib/auth/pharmacy-scope";
import { ProductsContent } from "./_components/products-content";
import ProductsLoading from "./loading";

export const instant = false;

export default function ProductosPage({ params }: PharmacyParams) {
  return (
    <Suspense fallback={<ProductsLoading />}>
      <ProductsContent params={params} />
    </Suspense>
  );
}

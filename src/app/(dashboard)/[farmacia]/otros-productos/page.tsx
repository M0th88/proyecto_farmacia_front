import { Suspense } from "react";
import type { PharmacyParams } from "@/lib/auth/pharmacy-scope";
import { ProductsContent } from "../productos-y-empaques/_components/products-content";
import Loading from "./loading";

export const instant = false;

export default function Page({ params }: PharmacyParams) {
  return (
    <Suspense fallback={<Loading />}>
      <ProductsContent params={params} otros />
    </Suspense>
  );
}

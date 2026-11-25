import "server-only";
import { type PharmacyDb, pharmacyDb } from "@/lib/db/pharmacy-db";
import { isPharmacy, type Pharmacy } from "./pharmacies";
import type { PharmacyParams } from "./pharmacy-scope";

export function pharmacyRoute(
  handler: (
    request: Request,
    pharmacy: Pharmacy,
    db: PharmacyDb,
  ) => Promise<Response>,
) {
  return async (request: Request, { params }: PharmacyParams) => {
    const { farmacia } = await params;
    if (!isPharmacy(farmacia)) return new Response(null, { status: 404 });
    return handler(request, farmacia, pharmacyDb(farmacia));
  };
}

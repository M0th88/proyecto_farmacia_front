import "server-only";
import { notFound } from "next/navigation";
import { isPharmacy } from "./pharmacies";

export type PharmacyParams = { params: Promise<{ farmacia: string }> };
export async function resolvePharmacy(params: PharmacyParams["params"]) {
  const { farmacia } = await params;
  if (!isPharmacy(farmacia)) notFound();
  return farmacia;
}

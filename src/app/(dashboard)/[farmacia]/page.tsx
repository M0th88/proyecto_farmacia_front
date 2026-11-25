import { redirect } from "next/navigation";
import {
  type PharmacyParams,
  resolvePharmacy,
} from "@/lib/auth/pharmacy-scope";

export default async function FarmaciaPage({ params }: PharmacyParams) {
  const pharmacy = await resolvePharmacy(params);
  redirect(`/${pharmacy}/panel`);
}

import { requirePharmacySection } from "@/lib/auth/pharmacy-permissions";
import {
  type PharmacyParams,
  resolvePharmacy,
} from "@/lib/auth/pharmacy-scope";
import { EmptyPrivateSection } from "../_components/empty-private-section";

export const instant = false;

export default async function Page({ params }: PharmacyParams) {
  const pharmacy = await resolvePharmacy(params);
  await requirePharmacySection(pharmacy, "/otros-productos");
  return <EmptyPrivateSection title="Otros Productos" />;
}

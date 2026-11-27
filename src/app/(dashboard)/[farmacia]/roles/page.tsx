import { Suspense } from "react";
import { requirePharmacySection } from "@/lib/auth/pharmacy-permissions";
import {
  type PharmacyParams,
  resolvePharmacy,
} from "@/lib/auth/pharmacy-scope";
import { RolesTable } from "./_components/roles-table";
import RolesLoading from "./loading";

export const instant = false;

async function RolesContent({ params }: PharmacyParams) {
  const pharmacy = await resolvePharmacy(params);
  const user = await requirePharmacySection(pharmacy, "/roles");
  return <RolesTable currentUserId={user.id} />;
}

export default function RolesPage({ params }: PharmacyParams) {
  return (
    <Suspense fallback={<RolesLoading />}>
      <RolesContent params={params} />
    </Suspense>
  );
}

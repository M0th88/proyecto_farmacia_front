import { fichaPaciente } from "@/lib/asistencial/dispensacion";
import {
  type PharmacyParams,
  resolvePharmacy,
} from "@/lib/auth/pharmacy-scope";
import { requirePharmacyUser } from "@/lib/auth/session";
import { canOperate } from "@/lib/fefo";
import { rutSchema } from "@/lib/validation/dispensacion";
import { SinPermiso, SoloAsistencial } from "../_components/solo-asistencial";
import { Dispensacion } from "./_components/dispensacion";

export default async function DispensacionPage({
  params,
  searchParams,
}: PharmacyParams & { searchParams: Promise<{ rut?: string }> }) {
  const pharmacy = await resolvePharmacy(params);
  const user = await requirePharmacyUser(pharmacy);
  if (pharmacy !== "asistencial")
    return <SoloAsistencial titulo="Dispensación" />;
  if (!canOperate(user, "pos"))
    return <SinPermiso texto="Tu rol no puede registrar dispensaciones." />;
  const { rut } = await searchParams;
  const valido = rutSchema("RUT").safeParse(rut ?? "");
  const ficha = valido.success ? await fichaPaciente(valido.data) : null;
  return <Dispensacion fichaInicial={ficha} />;
}

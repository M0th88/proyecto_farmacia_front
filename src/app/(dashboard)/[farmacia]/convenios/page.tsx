import { connection } from "next/server";
import {
  type PharmacyParams,
  resolvePharmacy,
} from "@/lib/auth/pharmacy-scope";
import { requirePharmacyUser } from "@/lib/auth/session";
import { canOperate } from "@/lib/fefo";
import { listarConvenios } from "@/lib/private/convenios";
import { Convenios } from "./_components/convenios";

export const instant = false;

export default async function ConveniosPage({ params }: PharmacyParams) {
  const pharmacy = await resolvePharmacy(params);
  const user = await requirePharmacyUser(pharmacy);
  if (pharmacy !== "privada")
    return (
      <section className="pos-shell">
        <header className="pos-header">
          <div>
            <h1>Convenios</h1>
            <span>
              Disponible en Farmacia Privada. En la red pública la entrega es
              sin costo bajo programas de salud.
            </span>
          </div>
        </header>
      </section>
    );
  if (!canOperate(user, "convenios"))
    return (
      <section className="pos-shell">
        <p className="pos-empty" role="alert">
          Tu rol no puede administrar convenios.
        </p>
      </section>
    );
  await connection();
  return <Convenios inicial={await listarConvenios()} />;
}

import { connection } from "next/server";
import {
  type PharmacyParams,
  resolvePharmacy,
} from "@/lib/auth/pharmacy-scope";
import { requirePharmacyUser } from "@/lib/auth/session";
import { canOperate } from "@/lib/fefo";
import { registrosLibro, resumenLibro } from "@/lib/private/controlados";
import { LibroControlados } from "./_components/libro-controlados";

export const instant = false;

export default async function LibroControladosPage({
  params,
  searchParams,
}: PharmacyParams & {
  searchParams: Promise<{ medicamento?: string; pendientes?: string }>;
}) {
  const pharmacy = await resolvePharmacy(params);
  const user = await requirePharmacyUser(pharmacy);
  if (pharmacy !== "privada")
    return (
      <section className="pos-shell">
        <header className="pos-header">
          <div>
            <h1>Libro de Controlados</h1>
            <span>
              Disponible en Farmacia Privada. La dispensación asistencial se
              registrará en su propio módulo.
            </span>
          </div>
        </header>
      </section>
    );
  if (
    user.rol.nombre !== "Administrador" &&
    !user.rol.permisos.includes("controlados") &&
    !user.rol.permisos.includes("controlados_firmar")
  )
    return (
      <section className="pos-shell">
        <p className="pos-empty" role="alert">
          Tu rol no tiene acceso al libro de controlados.
        </p>
      </section>
    );
  await connection();
  const { medicamento, pendientes } = await searchParams;
  const medicamentoId = Number(medicamento) || undefined;
  const soloPendientes = pendientes === "1";
  const [resumen, registros] = await Promise.all([
    resumenLibro(),
    registrosLibro({ medicamentoId, soloPendientes }),
  ]);
  return (
    <LibroControlados
      resumen={resumen}
      registros={registros}
      filtro={{ medicamentoId, soloPendientes }}
      puedeFirmar={canOperate(user, "controlados_firmar")}
    />
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import {
  type PharmacyParams,
  resolvePharmacy,
} from "@/lib/auth/pharmacy-scope";
import { getPharmacyUser } from "@/lib/auth/session";
import { pharmacyDb } from "@/lib/db/pharmacy-db";
import { productLabel } from "@/lib/private/products";
import { EtiquetasLoading } from "./_components/etiquetas-loading";
import { EtiquetasProductos } from "./_components/etiquetas-productos";

export const instant = false;

type Props = PharmacyParams & {
  searchParams: Promise<{ producto?: string | string[] }>;
};

async function ContenidoEtiquetas({ params, searchParams }: Props) {
  const pharmacy = await resolvePharmacy(params);
  const user = await getPharmacyUser(pharmacy);
  if (!user) redirect(`/login/${pharmacy}`);
  if (
    user.rol.nombre !== "Administrador" &&
    !user.rol.permisos.includes("catalogo")
  ) {
    redirect(`/${pharmacy}/sin-acceso`);
  }

  const { producto } = await searchParams;
  const id = typeof producto === "string" ? Number(producto) : NaN;
  const inicial =
    Number.isInteger(id) && id > 0 && id <= 2_147_483_647
      ? await productLabel(id, pharmacyDb(pharmacy))
      : null;

  return (
    <EtiquetasProductos
      currentUserId={user.id}
      inicial={inicial}
      productoNoDisponible={producto !== undefined && !inicial}
    />
  );
}

export default async function EtiquetasProductosPage({
  params,
  searchParams,
}: Props) {
  const pharmacy = await resolvePharmacy(params);
  return (
    <section className="pos-shell">
      <header className="pos-header">
        <div>
          <Link href={`/${pharmacy}/productos-y-empaques`}>
            ‹ Productos y Empaques
          </Link>
          <h1>Etiquetas de productos</h1>
          <span>
            Asigna códigos internos e imprime etiquetas para venta por unidad.
          </span>
        </div>
      </header>
      <Suspense fallback={<EtiquetasLoading />}>
        <ContenidoEtiquetas params={params} searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

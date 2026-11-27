import Link from "next/link";
import { Suspense } from "react";
import { requirePharmacySection } from "@/lib/auth/pharmacy-permissions";
import {
  type PharmacyParams,
  resolvePharmacy,
} from "@/lib/auth/pharmacy-scope";
import { pharmacyDb } from "@/lib/db/pharmacy-db";
import { productLabel } from "@/lib/private/products";
import { EtiquetasProductos } from "./_components/etiquetas-productos";

export const instant = false;

type Props = PharmacyParams & {
  searchParams: Promise<{ producto?: string | string[] }>;
};

async function ContenidoEtiquetas({ params, searchParams }: Props) {
  const pharmacy = await resolvePharmacy(params);
  const user = await requirePharmacySection(pharmacy, "/productos-y-empaques");

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
      <Suspense
        fallback={<p role="status">Cargando generador de etiquetas…</p>}
      >
        <ContenidoEtiquetas params={params} searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

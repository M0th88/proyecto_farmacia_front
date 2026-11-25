import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getPrivateUser } from "@/lib/auth/session";
import { productLabel } from "@/lib/private/products";
import { EtiquetasProductos } from "./_components/etiquetas-productos";

export const instant = false;

type Props = { searchParams: Promise<{ producto?: string | string[] }> };

async function ContenidoEtiquetas({ searchParams }: Props) {
  const user = await getPrivateUser();
  if (!user) redirect("/login/privada");
  if (
    user.rol.nombre !== "Administrador" &&
    !user.rol.permisos.includes("catalogo")
  ) {
    redirect("/privada/sin-acceso");
  }

  const { producto } = await searchParams;
  const id = typeof producto === "string" ? Number(producto) : NaN;
  const inicial =
    Number.isInteger(id) && id > 0 && id <= 2_147_483_647
      ? await productLabel(id)
      : null;

  return (
    <EtiquetasProductos
      currentUserId={user.id}
      inicial={inicial}
      productoNoDisponible={producto !== undefined && !inicial}
    />
  );
}

export default function EtiquetasProductosPage({ searchParams }: Props) {
  return (
    <section className="pos-shell">
      <header className="pos-header">
        <div>
          <Link href="/privada/productos-y-empaques">
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
        <ContenidoEtiquetas searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

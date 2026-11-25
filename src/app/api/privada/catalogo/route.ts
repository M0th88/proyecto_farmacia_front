import { prismaPrivada } from "@/lib/db/prisma-privada";
import { aptStock, canOperate } from "@/lib/fefo";
import { currentPrivateUser } from "@/lib/private/auth";

export async function GET(request: Request) {
  const branchId = Number(new URL(request.url).searchParams.get("sucursalId"));
  const user = await currentPrivateUser();
  if (!user || !canOperate(user, "pos"))
    return Response.json({ error: "Debes iniciar sesión." }, { status: 401 });
  try {
    const medicamentos = await prismaPrivada.medicamento.findMany({
      where: { activo: true },
      include: {
        categoria: true,
        lotes: {
          include: { stocks: { include: { ubicacion: true } } },
          orderBy: { fechaVencimiento: "asc" },
        },
      },
      orderBy: { nombre: "asc" },
    });

    return Response.json(
      medicamentos.map((m) => ({
        id: m.id,
        nombre: m.nombre,
        codigoBarra: m.codigoBarra,
        concentracion: m.concentracion,
        formaFarmaceutica: m.formaFarmaceutica,
        categoria: m.categoria?.nombre ?? "Sin categoría",
        precio: m.precioVenta === null ? null : Number(m.precioVenta),
        condicionVenta: m.condicionVenta,
        stockMinimo: m.stockMinimo,
        stock: m.lotes.reduce(
          (sum, lote) =>
            sum +
            lote.stocks
              .filter(
                (stock) =>
                  stock.ubicacion.sucursalId === branchId &&
                  aptStock({ ...stock, lote }),
              )
              .reduce((n, stock) => n + stock.cantidad, 0),
          0,
        ),
      })),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Catálogo privado:", error);
    return Response.json(
      { error: "No se pudo cargar el catálogo." },
      { status: 503 },
    );
  }
}

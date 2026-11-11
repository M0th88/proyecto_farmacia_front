import { prismaPrivada } from "@/lib/db/prisma-privada";
import { currentPrivateUser } from "@/lib/private/auth";

export async function GET() {
  if (!await currentPrivateUser()) return Response.json({ error: "Debes iniciar sesión." }, { status: 401 });
  try {
    const medicamentos = await prismaPrivada.medicamento.findMany({
      where: { activo: true },
      include: { categoria: true, lotes: { include: { stocks: true }, orderBy: { fechaVencimiento: "asc" } } },
      orderBy: { nombre: "asc" },
    });
    const ahora = new Date();
    return Response.json(medicamentos.map((m) => ({
      id: m.id, nombre: m.nombre, codigoBarra: m.codigoBarra,
      concentracion: m.concentracion, formaFarmaceutica: m.formaFarmaceutica,
      categoria: m.categoria?.nombre ?? "Sin categoría",
      precio: m.precioVenta === null ? null : Number(m.precioVenta),
      condicionVenta: m.condicionVenta,
      stockMinimo: m.stockMinimo,
      stock: m.lotes.filter((l) => l.fechaVencimiento > ahora).reduce((s, l) => s + l.stocks.reduce((n, x) => n + x.cantidad, 0), 0),
    })), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Catálogo privado:", error);
    return Response.json({ error: "No se pudo cargar el catálogo." }, { status: 503 });
  }
}

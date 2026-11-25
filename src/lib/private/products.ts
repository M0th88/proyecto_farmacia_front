import "server-only";
import { randomInt } from "node:crypto";
import { z } from "zod";
import { Prisma } from "@/generated/privada/client";
import type { PharmacyDb } from "@/lib/db/pharmacy-db";
import { prismaPrivada } from "@/lib/db/prisma-privada";
import type { PaginationResponse } from "@/lib/types/pagination";
import type {
  ProductDetail,
  ProductLabel,
  ProductMetrics,
  ProductProfile,
  ProductRow,
} from "@/lib/types/productos";
import { emptyChileFields } from "@/lib/types/productos";
import { stockDate } from "./stock-dates";

export const productListSchema = z.object({
  page: z.coerce.number().int().min(0).default(0),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
  search: z.string().trim().max(200).default(""),
  sort: z
    .enum([
      "id",
      "nombre",
      "codigoBarra",
      "codigoCatalogo",
      "codigoAtc",
      "fuenteCatalogo",
      "principioActivo",
      "concentracion",
      "formaFarmaceutica",
      "categoria",
      "precioVenta",
      "condicionVenta",
      "stockMinimo",
      "stock",
      "activo",
      "creadoEn",
      "actualizadoEn",
    ])
    .default("nombre"),
  direction: z.enum(["asc", "desc"]).default("asc"),
});
export async function productSnapshot(
  db: PharmacyDb = prismaPrivada as unknown as PharmacyDb,
) {
  const products = await db.medicamento.findMany({
    orderBy: { nombre: "asc" },
    include: { categoria: true, lotes: { include: { stocks: true } } },
  });
  const rows: ProductRow[] = products.map((product) => ({
    id: product.id,
    nombre: product.nombre,
    codigoBarra: product.codigoBarra,
    codigoCatalogo: product.codigoCatalogo,
    codigoAtc: product.codigoAtc,
    fuenteCatalogo: product.fuenteCatalogo,
    principioActivo: product.principioActivo,
    concentracion: product.concentracion,
    formaFarmaceutica: product.formaFarmaceutica,
    categoria: product.categoria?.nombre ?? "Sin categoría",
    precioVenta:
      product.precioVenta === null ? null : Number(product.precioVenta),
    condicionVenta: product.condicionVenta,
    stockMinimo: product.stockMinimo,
    stock: product.lotes.reduce(
      (n, lot) => n + lot.stocks.reduce((s, stock) => s + stock.cantidad, 0),
      0,
    ),
    activo: product.activo,
    creadoEn: product.creadoEn.toISOString(),
    actualizadoEn: product.actualizadoEn.toISOString(),
  }));
  const metrics: ProductMetrics = {
    productos: rows.length,
    sinPrecio: rows.filter((row) => row.precioVenta === null).length,
    sinCodigo: rows.filter((row) => !row.codigoBarra).length,
    sinClasificar: rows.filter((row) => row.condicionVenta === "SIN_CLASIFICAR")
      .length,
  };
  return { rows, metrics };
}
export function paginateProducts(
  rows: ProductRow[],
  options: z.infer<typeof productListSchema>,
): PaginationResponse<ProductRow> {
  const { page, pageSize, search, sort, direction } = options;
  const normalize = (value: string) =>
    value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("es");
  const filtered = rows.filter((row) =>
    normalize(
      [
        row.nombre,
        row.codigoBarra,
        row.codigoCatalogo,
        row.codigoAtc,
        row.principioActivo,
        row.concentracion,
        row.formaFarmaceutica,
        row.categoria,
        row.condicionVenta.replaceAll("_", " "),
        row.activo ? "Activo" : "Inactivo",
      ].join(" "),
    ).includes(normalize(search)),
  );
  filtered.sort((a, b) => {
    const x = a[sort],
      y = b[sort];
    const comparison =
      typeof x === "number" && typeof y === "number"
        ? x - y
        : typeof x === "boolean" && typeof y === "boolean"
          ? Number(x) - Number(y)
          : String(x ?? "").localeCompare(String(y ?? ""), "es", {
              numeric: true,
            });
    return (direction === "desc" ? -comparison : comparison) || a.id - b.id;
  });
  const start = page * pageSize;
  return {
    data: filtered.slice(start, start + pageSize),
    totalRows: filtered.length,
    nextPage: start + pageSize < filtered.length ? page + 1 : null,
  };
}
export async function createProduct(
  input: ProductProfile,
  id?: number,
  db: PharmacyDb = prismaPrivada as unknown as PharmacyDb,
) {
  return db.$transaction(async (tx) => {
    if (id && !(await tx.medicamento.findUnique({ where: { id } })))
      throw new Error("El producto ya no existe.");
    let categoryId = input.categoriaId > 0 ? input.categoriaId : null;
    if (
      categoryId &&
      !(await tx.categoriaMedicamento.findUnique({ where: { id: categoryId } }))
    )
      throw new Error(
        "La categoría ya no existe. Actualiza e intenta nuevamente.",
      );
    if (input.categoriaId === -1) {
      const category = await tx.categoriaMedicamento.upsert({
        where: { nombre: input.categoriaNombre },
        update: {},
        create: {
          nombre: input.categoriaNombre,
          descripcion: input.categoriaDescripcion || null,
        },
      });
      categoryId = category.id;
    }
    const ficha = Object.fromEntries(
      Object.entries(input.fichaChile).map(([key, value]) => [
        key,
        value || null,
      ]),
    );
    const data = {
      nombre: input.nombre,
      codigoBarra: input.codigoBarra || null,
      codigoCatalogo: input.codigoCatalogo || null,
      codigoAtc: input.codigoAtc || null,
      fuenteCatalogo: input.fuenteCatalogo || null,
      principioActivo: input.principioActivo || null,
      concentracion: input.concentracion || null,
      formaFarmaceutica: input.formaFarmaceutica || null,
      precioVenta: input.precioVenta
        ? input.precioVenta.replace(",", ".")
        : null,
      condicionVenta: input.condicionVenta,
      stockMinimo: input.stockMinimo,
      activo: input.activo,
      categoriaId: categoryId,
    };
    return id
      ? tx.medicamento.update({
          where: { id },
          data: {
            ...data,
            fichaChile: { upsert: { create: ficha, update: ficha } },
          },
          select: { id: true, nombre: true },
        })
      : tx.medicamento.create({
          data: {
            ...data,
            ...(Object.values(input.fichaChile).some(Boolean)
              ? { fichaChile: { create: ficha } }
              : {}),
          },
          select: { id: true, nombre: true },
        });
  });
}

export async function productDetail(
  id: number,
  db: PharmacyDb = prismaPrivada as unknown as PharmacyDb,
): Promise<ProductDetail | null> {
  const product = await db.medicamento.findUnique({
    where: { id },
    include: { fichaChile: true },
  });
  if (!product) return null;
  return {
    id: product.id,
    creadoEn: product.creadoEn.toISOString(),
    actualizadoEn: product.actualizadoEn.toISOString(),
    profile: {
      nombre: product.nombre,
      codigoBarra: product.codigoBarra ?? "",
      codigoCatalogo: product.codigoCatalogo ?? "",
      codigoAtc: product.codigoAtc ?? "",
      fuenteCatalogo: product.fuenteCatalogo ?? "",
      principioActivo: product.principioActivo ?? "",
      concentracion: product.concentracion ?? "",
      formaFarmaceutica: product.formaFarmaceutica ?? "",
      precioVenta: product.precioVenta?.toString() ?? "",
      condicionVenta: product.condicionVenta,
      stockMinimo: product.stockMinimo,
      activo: product.activo,
      categoriaId: product.categoriaId ?? 0,
      categoriaNombre: "",
      categoriaDescripcion: "",
      fichaChile: Object.fromEntries(
        Object.keys(emptyChileFields).map((key) => [
          key,
          product.fichaChile?.[key as keyof typeof emptyChileFields] ?? "",
        ]),
      ) as ProductProfile["fichaChile"],
    },
  };
}

export async function deleteProduct(
  id: number,
  db: PharmacyDb = prismaPrivada as unknown as PharmacyDb,
) {
  return db.$transaction(
    async (tx) => {
      const product = await tx.medicamento.findUnique({
        where: { id },
        include: { _count: { select: { lotes: true, detallesVenta: true } } },
      });
      if (!product) throw new Error("El producto ya no existe.");
      if (product._count.lotes || product._count.detallesVenta)
        throw new Error(
          "El producto tiene lotes o ventas registrados y no se puede eliminar. Puedes desactivarlo desde Editar.",
        );
      await tx.fichaMedicamentoChile.deleteMany({
        where: { medicamentoId: id },
      });
      await tx.medicamento.delete({ where: { id } });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function productLabel(
  id: number,
  db: PharmacyDb = prismaPrivada as unknown as PharmacyDb,
): Promise<ProductLabel | null> {
  const product = await db.medicamento.findUnique({
    where: { id },
    select: {
      id: true,
      nombre: true,
      codigoBarra: true,
      lotes: {
        orderBy: [{ fechaVencimiento: "asc" }, { id: "asc" }],
        select: {
          id: true,
          numeroLote: true,
          fechaVencimiento: true,
          stocks: {
            where: { cantidad: { gt: 0 } },
            orderBy: { ubicacion: { nombre: "asc" } },
            select: { ubicacion: { select: { id: true, nombre: true } } },
          },
        },
      },
    },
  });
  if (!product) return null;
  return {
    id: product.id,
    nombre: product.nombre,
    codigoBarra: product.codigoBarra || null,
    lotes: product.lotes.map((lote) => ({
      id: lote.id,
      numero: lote.numeroLote,
      vencimiento: stockDate(lote.fechaVencimiento),
      ubicaciones: lote.stocks.map(({ ubicacion }) => ubicacion),
    })),
  };
}

export async function assignProductBarcode(
  id: number,
  db: PharmacyDb = prismaPrivada as unknown as PharmacyDb,
) {
  const product = await productLabel(id, db);
  if (!product || product.codigoBarra) return product;

  for (let attempt = 0; attempt < 3; attempt++) {
    const digits = String(randomInt(10_000_000_000)).padStart(10, "0");
    try {
      await db.medicamento.updateMany({
        where: { id, OR: [{ codigoBarra: null }, { codigoBarra: "" }] },
        data: { codigoBarra: `FP${digits}` },
      });
      return productLabel(id, db);
    } catch (error) {
      if (
        !(
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        )
      )
        throw error;
    }
  }
  throw new Error("No se pudo asignar un código único. Intenta nuevamente.");
}

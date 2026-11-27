// Catalog tests using a simulated database; no real products are created.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(path, dependencies = {}) {
  const { outputText } = ts.transpileModule(
    readFileSync(new URL(path, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  );
  const result = { exports: {} };
  new Function("require", "module", "exports", outputText)(
    (name) => dependencies[name] ?? require(name),
    result,
    result.exports,
  );
  return result.exports;
}
const types = load("../src/lib/types/productos.ts");
const { productProfileSchema, emptyChileFields } = types;
let state = { products: [], categories: [], fichas: [] };
let failProduct = false;
class PrismaClientKnownRequestError extends Error {
  code = "P2002";
}
let barcodeWrites = 0;
let barcodeSequence = 0;
const db = {
  categoriaMedicamento: {
    findMany: async () => state.categories,
    findUnique: async ({ where }) =>
      state.categories.find((category) => category.id === where.id),
    upsert: async ({ where, create }) => {
      let category = state.categories.find(
        (item) => item.nombre === where.nombre,
      );
      if (!category) {
        category = { id: state.categories.length + 1, ...create };
        state.categories.push(category);
      }
      return category;
    },
  },
  medicamento: {
    findUnique: async ({ where }) => {
      const product = state.products.find((item) => item.id === where.id);
      return product
        ? structuredClone({
            ...product,
            fichaChile:
              state.fichas.find((f) => f.medicamentoId === product.id) ?? null,
            _count: {
              lotes: product.lotes.length,
              detallesVenta: product.ventas ?? 0,
            },
          })
        : null;
    },
    updateMany: async ({ where, data }) => {
      assert.deepEqual(where.OR, [{ codigoBarra: null }, { codigoBarra: "" }]);
      const product = state.products.find((item) => item.id === where.id);
      if (!product || product.codigoBarra) return { count: 0 };
      barcodeWrites++;
      if (state.products.some((item) => item.codigoBarra === data.codigoBarra))
        throw new PrismaClientKnownRequestError();
      product.codigoBarra = data.codigoBarra;
      return { count: 1 };
    },
    update: async ({ where, data }) => {
      const product = state.products.find((item) => item.id === where.id);
      const { fichaChile, ...fields } = data;
      if (
        state.products.some(
          (item) =>
            item.id !== where.id &&
            ((data.codigoBarra && item.codigoBarra === data.codigoBarra) ||
              (data.codigoCatalogo &&
                item.codigoCatalogo === data.codigoCatalogo)),
        )
      )
        throw Object.assign(new Error("Duplicado"), { code: "P2002" });
      Object.assign(product, fields);
      if (fichaChile) {
        const ficha = state.fichas.find(
          (item) => item.medicamentoId === where.id,
        );
        if (ficha) Object.assign(ficha, fichaChile.upsert.update);
        else
          state.fichas.push({
            medicamentoId: where.id,
            ...fichaChile.upsert.create,
          });
      }
      return { id: product.id, nombre: product.nombre };
    },
    delete: async ({ where }) => {
      state.products = state.products.filter((item) => item.id !== where.id);
    },
    findMany: async () =>
      state.products.map((product) => ({
        ...product,
        categoria:
          state.categories.find((c) => c.id === product.categoriaId) ?? null,
      })),
    create: async ({ data }) => {
      if (failProduct) throw new Error("Fallo de escritura");
      if (
        state.products.some(
          (product) =>
            (data.codigoBarra && data.codigoBarra === product.codigoBarra) ||
            (data.codigoCatalogo &&
              data.codigoCatalogo === product.codigoCatalogo),
        )
      )
        throw Object.assign(new Error("Duplicado"), { code: "P2002" });
      const { fichaChile, ...fields } = data;
      const product = {
        id: state.products.length + 1,
        ...fields,
        creadoEn: new Date(),
        actualizadoEn: new Date(),
        lotes: [],
      };
      state.products.push(product);
      if (fichaChile)
        state.fichas.push({ medicamentoId: product.id, ...fichaChile.create });
      return { id: product.id, nombre: product.nombre };
    },
  },
  fichaMedicamentoChile: {
    deleteMany: async ({ where }) => {
      state.fichas = state.fichas.filter(
        (ficha) => ficha.medicamentoId !== where.medicamentoId,
      );
    },
  },
  $transaction: async (work) => {
    const previous = structuredClone(state);
    try {
      return await work(db);
    } catch (error) {
      state = previous;
      throw error;
    }
  },
};
const deps = {
  "server-only": {},
  "node:crypto": { randomInt: () => barcodeSequence++ },
  "./stock-dates": load("../src/lib/private/stock-dates.ts"),
  "@/lib/db/prisma-privada": { prismaPrivada: db },
  "@/lib/types/productos": types,
  "@/generated/privada/client": {
    Prisma: {
      TransactionIsolationLevel: { Serializable: "Serializable" },
      PrismaClientKnownRequestError,
    },
  },
};
const service = load("../src/lib/private/products.ts", deps);
const profile = {
  nombre: "Paracetamol",
  codigoBarra: "",
  codigoCatalogo: "",
  codigoAtc: "",
  fuenteCatalogo: "",
  principioActivo: "",
  concentracion: "",
  formaFarmaceutica: "",
  precioVenta: "",
  condicionVenta: "SIN_CLASIFICAR",
  stockMinimo: 0,
  activo: true,
  categoriaId: 0,
  categoriaNombre: "",
  categoriaDescripcion: "",
  fichaChile: { ...emptyChileFields },
};
assert.equal(productProfileSchema.safeParse(profile).success, true);
for (const precioVenta of ["-1", "1.234", "99999999999", "texto", "Infinity"])
  assert.equal(
    productProfileSchema.safeParse({ ...profile, precioVenta }).success,
    false,
  );
for (const precioVenta of ["", "0", "12,50", "9999999999.99"])
  assert.equal(
    productProfileSchema.safeParse({ ...profile, precioVenta }).success,
    true,
  );
for (const stockMinimo of [-1, 1.5, 2147483648])
  assert.equal(
    productProfileSchema.safeParse({ ...profile, stockMinimo }).success,
    false,
  );
assert.equal(
  productProfileSchema.safeParse({ ...profile, nombre: " " }).success,
  false,
);
assert.equal(
  productProfileSchema.safeParse({ ...profile, categoriaId: -1 }).success,
  false,
);
assert.equal(
  productProfileSchema.safeParse({ ...profile, condicionVenta: "INVALIDA" })
    .success,
  false,
);
const first = await service.createProduct(productProfileSchema.parse(profile));
assert.equal(first.id, 1);
assert.equal(state.products[0].codigoBarra, null);
assert.equal(state.products[0].precioVenta, null);
assert.equal(state.fichas.length, 0);
const rich = productProfileSchema.parse({
  ...profile,
  nombre: "Ácido fólico",
  codigoBarra: "111",
  codigoCatalogo: "MED-TEST",
  codigoAtc: "B03BB01",
  fuenteCatalogo: "Registro local",
  principioActivo: "Ácido fólico",
  concentracion: "5 mg",
  formaFarmaceutica: "Comprimido",
  precioVenta: "2500,50",
  condicionVenta: "RECETA_SIMPLE",
  stockMinimo: 10,
  categoriaId: -1,
  categoriaNombre: "Vitaminas",
  categoriaDescripcion: "Grupo",
  fichaChile: {
    ...emptyChileFields,
    registroIsp: "F-TEST",
    laboratorioTitular: "Laboratorio",
    viaAdministracion: "Oral",
    observaciones: "Ficha",
  },
});
await service.createProduct(rich);
assert.equal(state.categories.length, 1);
assert.equal(state.products[1].precioVenta, "2500.50");
assert.equal(state.products[1].categoriaId, 1);
assert.equal(state.products[1].principioActivo, "Ácido fólico");
assert.equal(state.fichas[0].registroIsp, "F-TEST");
assert.equal(state.fichas[0].viaAdministracion, "Oral");
assert.equal(state.fichas[0].estadoIsp, null);
await service.createProduct({
  ...profile,
  nombre: "Otro",
  categoriaId: -1,
  categoriaNombre: "Vitaminas",
  activo: false,
});
assert.equal(state.categories.length, 1);
await assert.rejects(
  service.createProduct({ ...profile, categoriaId: 999 }),
  /categoría/,
);
await assert.rejects(
  service.createProduct({ ...profile, codigoBarra: "111" }),
  /Duplicado/,
);
await assert.rejects(
  service.createProduct({ ...profile, codigoCatalogo: "MED-TEST" }),
  /Duplicado/,
);
const baseline = structuredClone(state);
failProduct = true;
await assert.rejects(
  service.createProduct({
    ...profile,
    categoriaId: -1,
    categoriaNombre: "Revertida",
  }),
  /Fallo/,
);
failProduct = false;
assert.deepEqual(state, baseline);
state.products[0].lotes = [{ stocks: [{ cantidad: 3 }, { cantidad: 4 }] }];
const snapshot = await service.productSnapshot();
assert.equal(snapshot.rows[0].stock, 7);
assert.deepEqual(snapshot.metrics, {
  productos: 3,
  sinPrecio: 2,
  sinCodigo: 2,
  sinClasificar: 2,
});
assert.equal(
  service.paginateProducts(
    snapshot.rows,
    service.productListSchema.parse({ search: "acido" }),
  ).totalRows,
  1,
);
assert.equal(
  service.paginateProducts(
    snapshot.rows,
    service.productListSchema.parse({ search: "vitaminas" }),
  ).totalRows,
  2,
);
assert.equal(
  service.paginateProducts(
    snapshot.rows,
    service.productListSchema.parse({ search: "sin coincidencias" }),
  ).totalRows,
  0,
);
const page = service.paginateProducts(
  snapshot.rows,
  service.productListSchema.parse({
    pageSize: 2,
    sort: "stock",
    direction: "desc",
  }),
);
assert.equal(page.data[0].stock, 7);
assert.equal(page.nextPage, 1);
let user = null;
const route = load("../src/app/api/[farmacia]/productos/route.ts", {
  "@/lib/auth/pharmacy-route": {
    pharmacyRoute: (handler) => (request) => handler(request, "privada", db),
  },
  ...deps,
  "@/lib/auth/session": { getPharmacyUser: async () => user },
  "@/lib/private/permissions": load("../src/lib/private/permissions.ts"),
  "@/lib/private/products": service,
  "@/lib/types/productos": types,
});
const request = (method, body, query = "") =>
  new Request(`http://localhost:3000/api/privada/productos${query}`, {
    method,
    ...(body
      ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
assert.equal((await route.GET(request("GET"))).status, 403);
user = { rol: { nombre: "Bodega", permisos: ["inventario"] } };
assert.equal((await route.POST(request("POST", profile))).status, 403);
assert.equal(
  (await route.POST(request("POST", { id: 1 }, "?etiqueta=1"))).status,
  403,
);
assert.equal(
  (await route.PATCH(request("PATCH", { ...profile, id: 1 }))).status,
  403,
);
user = { rol: { nombre: "Vendedor", permisos: ["catalogo"] } };
assert.equal(
  (await route.POST(request("POST", { ...profile, nombre: "" }))).status,
  400,
);
assert.equal(
  (await route.POST(request("POST", { ...profile, codigoBarra: "111" })))
    .status,
  409,
);
assert.equal(
  (await route.POST(request("POST", { ...profile, nombre: "Nuevo" }))).status,
  201,
);
assert.equal(
  (await route.GET(request("GET", undefined, "?page=-1"))).status,
  400,
);
assert.equal(
  (await route.GET(request("GET", undefined, "?opciones=1"))).status,
  200,
);
assert.equal(
  (await route.GET(request("GET", undefined, "?page=0"))).status,
  200,
);
assert.equal((await route.DELETE(request("DELETE", { id: 2 }))).status, 403);
const detail = await route.GET(request("GET", undefined, "?id=2"));
assert.equal(detail.status, 200);
const productDetail = await detail.json();
assert.equal(productDetail.profile.fichaChile.registroIsp, "F-TEST");
assert.equal(
  (
    await route.PATCH(
      request("PATCH", {
        ...productDetail.profile,
        id: 2,
        nombre: "Editado",
        activo: false,
      }),
    )
  ).status,
  200,
);
assert.equal(state.products.find((item) => item.id === 2).nombre, "Editado");
assert.equal(state.products.find((item) => item.id === 2).activo, false);
assert.equal(
  state.fichas.find((item) => item.medicamentoId === 2).registroIsp,
  "F-TEST",
);
user = { rol: { nombre: "Administrador", permisos: [] } };
assert.equal((await route.DELETE(request("DELETE", { id: 1 }))).status, 409);
state.products.find((item) => item.id === 3).ventas = 1;
assert.equal((await route.DELETE(request("DELETE", { id: 3 }))).status, 409);
assert.equal((await route.DELETE(request("DELETE", { id: 2 }))).status, 200);
assert.equal(
  state.products.some((item) => item.id === 2),
  false,
);
assert.equal(
  state.fichas.some((item) => item.medicamentoId === 2),
  false,
);

// Existing commercial codes are preserved and assigning twice is idempotent.
state.products[0].lotes = [
  {
    id: 5,
    numeroLote: "L-01",
    fechaVencimiento: new Date("2030-03-30T12:00:00Z"),
    stocks: [{ cantidad: 4, ubicacion: { id: 7, nombre: "Vitrina" } }],
  },
];
const other = state.products.find(({ id }) => id === 3);
other.codigoBarra = "FP0000000000";
const label = await route.GET(request("GET", null, "?etiqueta=1&id=1"));
assert.equal(label.status, 200);
assert.deepEqual((await label.json()).lotes, [
  {
    id: 5,
    numero: "L-01",
    vencimiento: "2030-03-30",
    ubicaciones: [{ id: 7, nombre: "Vitrina" }],
  },
]);
const existing = await route.POST(request("POST", { id: 3 }, "?etiqueta=1"));
assert.equal((await existing.json()).codigoBarra, "FP0000000000");
assert.equal(barcodeWrites, 0);
const assign = () => route.POST(request("POST", { id: 1 }, "?etiqueta=1"));
const assigned = await assign();
assert.equal(assigned.status, 200);
assert.equal((await assigned.json()).codigoBarra, "FP0000000001");
assert.equal((await (await assign()).json()).codigoBarra, "FP0000000001");
assert.equal(barcodeWrites, 2);
assert.equal(
  (await route.POST(request("POST", { id: 999 }, "?etiqueta=1"))).status,
  404,
);
assert.equal(
  (await route.POST(request("POST", { id: 0 }, "?etiqueta=1"))).status,
  400,
);

console.log(
  "Productos: validación, permisos, campos, ficha, categorías, duplicados, rollback, métricas, búsqueda, paginación y asignación de etiquetas verificados.",
);

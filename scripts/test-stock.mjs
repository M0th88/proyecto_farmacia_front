// Isolated inventory tests: never connect to the real database.
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
const dates = load("../src/lib/private/stock-dates.ts");
const { stockEntrySchema } = load("../src/lib/types/stock-y-lotes.ts");
let state = {
  products: [
    {
      id: 1,
      nombre: "Paracetamol",
      activo: true,
      codigoBarra: "111",
      condicionVenta: "VENTA_DIRECTA",
      stockMinimo: 6,
      precioVenta: 1000,
    },
    {
      id: 2,
      nombre: "Ácido fólico",
      activo: true,
      codigoBarra: null,
      condicionVenta: "VENTA_DIRECTA",
      stockMinimo: 0,
      precioVenta: null,
    },
    {
      id: 3,
      nombre: "Inactivo",
      activo: false,
      codigoBarra: null,
      condicionVenta: "SIN_CLASIFICAR",
      stockMinimo: 0,
      precioVenta: null,
    },
  ],
  locations: [{ id: 1, nombre: "Bodega", tipo: "BODEGA" }],
  lots: [],
  stocks: [],
  movements: [],
};
let failMovement = false;
const tx = {
  medicamento: {
    findUnique: async ({ where }) =>
      state.products.find((p) => p.id === where.id),
  },
  ubicacionInventario: {
    findUnique: async ({ where }) =>
      state.locations.find((p) => p.id === where.id),
    findFirst: async ({ where }) =>
      state.locations.find(
        (p) => p.nombre === where.nombre && p.tipo === where.tipo,
      ),
    create: async ({ data }) => {
      const row = { id: state.locations.length + 1, ...data };
      state.locations.push(row);
      return row;
    },
  },
  lote: {
    findUnique: async ({ where }) => {
      const lot = state.lots.find((item) => item.id === where.id);
      return lot
        ? structuredClone({
            ...lot,
            _count: {
              stocks: state.stocks.filter((item) => item.loteId === lot.id)
                .length,
              movimientos: state.movements.filter(
                (item) => item.loteId === lot.id,
              ).length,
              detallesVenta: lot.ventas ?? 0,
            },
          })
        : null;
    },
    delete: async ({ where }) => {
      state.lots = state.lots.filter((lot) => lot.id !== where.id);
    },
    update: async ({ where, data }) => {
      const row = state.lots.find((lot) => lot.id === where.id);
      Object.assign(row, data);
      return row;
    },
    upsert: async ({ where, create }) => {
      const key = where.medicamentoId_numeroLote;
      let row = state.lots.find(
        (p) =>
          p.medicamentoId === key.medicamentoId &&
          p.numeroLote === key.numeroLote,
      );
      if (!row) {
        row = { id: state.lots.length + 1, ...create };
        state.lots.push(row);
      }
      return row;
    },
  },
  stock: {
    findUnique: async ({ where }) => {
      const stock = state.stocks.find((item) => item.id === where.id);
      return stock
        ? structuredClone({
            ...stock,
            ubicacion: state.locations.find(
              (location) => location.id === stock.ubicacionId,
            ),
          })
        : null;
    },
    update: async ({ where, data }) => {
      const row = state.stocks.find((item) => item.id === where.id);
      Object.assign(row, data);
      return row;
    },
    delete: async ({ where }) => {
      state.stocks = state.stocks.filter((item) => item.id !== where.id);
    },
    upsert: async ({ where, create, update }) => {
      const key = where.loteId_ubicacionId;
      let row = state.stocks.find(
        (p) => p.loteId === key.loteId && p.ubicacionId === key.ubicacionId,
      );
      if (row) row.cantidad += update.cantidad.increment;
      else {
        row = { id: state.stocks.length + 1, ...create };
        state.stocks.push(row);
      }
      return row;
    },
  },
  movimientoStock: {
    create: async ({ data }) => {
      if (failMovement) throw new Error("Movimiento fallido");
      state.movements.push(data);
      return data;
    },
  },
};
const db = {
  ...tx,
  medicamento: {
    ...tx.medicamento,
    findMany: async () =>
      state.products.map((product) => ({
        ...product,
        lotes: state.lots
          .filter((lot) => lot.medicamentoId === product.id)
          .map((lot) => ({
            ...lot,
            stocks: state.stocks
              .filter((s) => s.loteId === lot.id)
              .map((s) => ({
                ...s,
                ubicacion: state.locations.find((l) => l.id === s.ubicacionId),
              })),
          })),
      })),
  },
  ubicacionInventario: {
    ...tx.ubicacionInventario,
    findMany: async () => state.locations,
  },
  $transaction: async (work, options) => {
    assert.equal(options.isolationLevel, "Serializable");
    const previous = structuredClone(state);
    try {
      return await work(tx);
    } catch (error) {
      state = previous;
      throw error;
    }
  },
};
const deps = {
  "server-only": {},
  "@/lib/db/prisma-privada": { prismaPrivada: db },
};
const service = load("../src/lib/private/add-stock.ts", {
  ...deps,
  "@/generated/privada/client": {
    Prisma: { TransactionIsolationLevel: { Serializable: "Serializable" } },
  },
  "./stock-dates": dates,
});
const listing = load("../src/lib/private/stock.ts", {
  ...deps,
  "./stock-dates": dates,
});
const entry = {
  medicamentoId: 1,
  numeroLote: "A1",
  fechaFabricacion: "2025-01-01",
  fechaVencimiento: "2100-01-01",
  ubicacionId: 1,
  ubicacionNombre: "",
  ubicacionTipo: "BODEGA",
  cantidad: 5,
  motivo: "Recepción",
};
assert.equal(stockEntrySchema.safeParse(entry).success, true);
for (const fechaFabricacion of ["", undefined, null]) {
  assert.equal(
    stockEntrySchema.safeParse({ ...entry, fechaFabricacion }).success,
    false,
  );
}
for (const cantidad of [0, -1, 1.5, 2147483648])
  assert.equal(
    stockEntrySchema.safeParse({ ...entry, cantidad }).success,
    false,
  );
assert.equal(
  stockEntrySchema.safeParse({ ...entry, fechaFabricacion: "2101-01-01" })
    .success,
  false,
);
assert.equal(
  stockEntrySchema.safeParse({ ...entry, ubicacionId: 0 }).success,
  false,
);
assert.equal(
  stockEntrySchema.safeParse({ ...entry, fechaVencimiento: "2026-02-30" })
    .success,
  false,
);
for (const day of ["2027-01-15", "2027-07-15"]) {
  assert.equal(dates.stockDate(dates.stockExpiry(day)), day);
  assert.equal(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "America/Santiago",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(dates.stockExpiry(day)),
    "23:59:59",
  );
}
let snapshot = await listing.stockSnapshot();
assert.equal(snapshot.metrics.productos, 3);
assert.equal(snapshot.metrics.bajo, 1);
assert.equal(snapshot.rows.filter((r) => r.estado === "Sin lotes").length, 3);
assert.equal((await service.addStock(entry, 7)).cantidad, 5);
assert.equal(
  (await service.addStock({ ...entry, cantidad: 3 }, 7)).cantidad,
  8,
);
assert.equal(state.lots.length, 1);
assert.equal(state.movements.length, 2);
const beforeLegacyLot = structuredClone(state);
state.lots[0].fechaFabricacion = null;
await service.addStock(entry, 7);
assert.equal(
  dates.stockDate(state.lots[0].fechaFabricacion),
  entry.fechaFabricacion,
);
state = beforeLegacyLot;
assert.match(state.movements[0].motivo, /usuario #7/);
await service.addStock(
  {
    ...entry,
    cantidad: 2,
    ubicacionId: 0,
    ubicacionNombre: "Mostrador",
    ubicacionTipo: "VITRINA",
  },
  7,
);
await service.addStock(
  {
    ...entry,
    cantidad: 1,
    ubicacionId: 0,
    ubicacionNombre: "Mostrador",
    ubicacionTipo: "VITRINA",
  },
  7,
);
assert.equal(state.locations.length, 2);
assert.deepEqual(
  state.stocks.map((s) => s.cantidad),
  [8, 3],
);
const beforeFailure = structuredClone(state);
await assert.rejects(
  service.addStock({ ...entry, fechaVencimiento: "2100-01-02" }, 7),
  /otras fechas/,
);
await assert.rejects(
  service.addStock({ ...entry, medicamentoId: 3 }, 7),
  /inactivo/,
);
await assert.rejects(
  service.addStock({ ...entry, ubicacionId: 999 }, 7),
  /ubicación/,
);
await assert.rejects(
  service.addStock({ ...entry, fechaVencimiento: "2000-01-01" }, 7),
  /vencido/,
);
failMovement = true;
await assert.rejects(
  service.addStock(
    {
      ...entry,
      numeroLote: "ROLLBACK",
      ubicacionId: 0,
      ubicacionNombre: "Revertida",
    },
    7,
  ),
  /Movimiento fallido/,
);
failMovement = false;
assert.deepEqual(
  state,
  beforeFailure,
  "A failed entry must roll back lot, location, quantity and movement.",
);
snapshot = await listing.stockSnapshot();
assert.equal(snapshot.metrics.bajo, 0);
assert.equal(snapshot.rows.filter((r) => r.nombre === "Paracetamol").length, 2);
const near = new Date(Date.now() + 5 * 86400000);
state.lots.push(
  {
    id: 2,
    medicamentoId: 2,
    numeroLote: "CERCANO",
    fechaFabricacion: null,
    fechaVencimiento: near,
  },
  {
    id: 3,
    medicamentoId: 2,
    numeroLote: "VENCIDO",
    fechaFabricacion: null,
    fechaVencimiento: new Date("2000-01-01"),
  },
);
state.stocks.push(
  { id: 3, loteId: 2, ubicacionId: 1, cantidad: 4 },
  { id: 4, loteId: 2, ubicacionId: 2, cantidad: 3 },
  { id: 5, loteId: 3, ubicacionId: 1, cantidad: 2 },
);
snapshot = await listing.stockSnapshot();
assert.equal(snapshot.metrics.proximos, 1, "Count lots, not locations.");
assert.equal(snapshot.metrics.vencidos, 1);
assert.equal(
  snapshot.rows.find((row) => row.numeroLote === "CERCANO").estado,
  `Vence en ${dates.stockDaysRemaining(near)} días`,
);
assert.equal(
  snapshot.rows.find((row) => row.numeroLote === "VENCIDO").estado,
  "Vencido",
);
assert.equal(
  snapshot.rows.find((row) => row.numeroLote === "A1").estado,
  `Vence en ${dates.stockDaysRemaining(dates.stockExpiry(entry.fechaVencimiento))} días`,
);
state.lots.find((lot) => lot.id === 2).fechaVencimiento = new Date(
  Date.now() + 10 * 86400000,
);
assert.equal(
  (await listing.stockSnapshot()).rows.find(
    (row) => row.numeroLote === "CERCANO",
  ).estado,
  "Vence en 10 días",
);
for (const days of [0, 1, 7, 10]) {
  const day = new Date(
    Date.parse(`${dates.stockDate(new Date())}T12:00:00Z`) + days * 86400000,
  );
  state.lots.find((lot) => lot.id === 2).fechaVencimiento = dates.stockExpiry(
    dates.stockDate(day),
  );
  const row = (await listing.stockSnapshot()).rows.find(
    (item) => item.numeroLote === "CERCANO",
  );
  assert.equal(row.diasParaVencer, days);
  assert.equal(
    row.estado,
    days === 0
      ? "Vence hoy"
      : days === 1
        ? "Vence en 1 día"
        : `Vence en ${days} días`,
  );
}
assert.equal(
  dates.stockDaysRemaining(
    dates.stockExpiry("2026-11-19"),
    new Date("2026-11-18T15:00:00Z"),
  ),
  1,
);
assert.equal(
  dates.stockDaysRemaining(
    dates.stockExpiry("2027-09-06"),
    new Date("2027-09-05T04:00:00Z"),
  ),
  1,
);
state.lots.find((lot) => lot.id === 2).fechaVencimiento = near;
assert.equal(
  listing.paginateStock(
    snapshot.rows,
    listing.stockListSchema.parse({ search: "acido" }),
  ).totalRows,
  3,
);
const first = listing.paginateStock(
  snapshot.rows,
  listing.stockListSchema.parse({
    pageSize: 2,
    sort: "cantidad",
    direction: "desc",
  }),
);
assert.deepEqual(
  first.data.map((r) => r.cantidad),
  [8, 4],
);
assert.equal(first.nextPage, 1);
assert.equal(
  listing.paginateStock(
    snapshot.rows,
    listing.stockListSchema.parse({ search: "no existe" }),
  ).totalRows,
  0,
);
let user = null;
const editService = load("../src/lib/private/edit-stock.ts", {
  ...deps,
  "@/generated/privada/client": {
    Prisma: { TransactionIsolationLevel: { Serializable: "Serializable" } },
  },
  "./stock-dates": dates,
});
const stockTypes = load("../src/lib/types/stock-y-lotes.ts");
const route = load("../src/app/api/privada/stock-y-lotes/route.ts", {
  ...deps,
  "@/lib/private/auth": { currentPrivateUser: async () => user },
  "@/lib/private/add-stock": service,
  "@/lib/private/stock": listing,
  "@/lib/private/stock-dates": dates,
  "@/lib/types/stock-y-lotes": stockTypes,
  "@/lib/private/edit-stock": editService,
});
const request = (method, body, query = "") =>
  new Request(`http://localhost:3000/api/privada/stock-y-lotes${query}`, {
    method,
    ...(body
      ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
assert.equal((await route.GET(request("GET"))).status, 403);
user = { id: 7, rol: { nombre: "Vendedor", permisos: ["catalogo"] } };
assert.equal((await route.POST(request("POST", entry))).status, 403);
user = { id: 7, rol: { nombre: "Bodega", permisos: ["inventario"] } };
assert.equal(
  (await route.POST(request("POST", { ...entry, cantidad: -1 }))).status,
  400,
);
assert.equal((await route.POST(request("POST", entry))).status, 201);
assert.equal(
  (await route.GET(request("GET", undefined, "?page=-1"))).status,
  400,
);
assert.equal(
  (await route.GET(request("GET", undefined, "?page=0"))).status,
  200,
);
const current = state.stocks.find((stock) => stock.id === 1);
const edit = {
  loteId: 1,
  stockId: 1,
  cantidadAnterior: current.cantidad,
  numeroLote: "EDITADO",
  fechaFabricacion: entry.fechaFabricacion,
  fechaVencimiento: entry.fechaVencimiento,
  cantidad: 2,
  motivo: "Conteo físico",
};
assert.equal((await route.DELETE(request("DELETE", edit))).status, 405);
assert.equal((await route.PATCH(request("PATCH", edit))).status, 200);
assert.equal(state.stocks.find((stock) => stock.id === 1).cantidad, 2);
assert.equal(state.movements.at(-1).tipo, "AJUSTE");
assert.equal(state.movements.at(-1).cantidad, 2 - edit.cantidadAnterior);
assert.equal(
  (await route.PATCH(request("PATCH", edit))).status,
  409,
  "Reject stale quantities.",
);
const beforeFailedEdit = structuredClone(state);
failMovement = true;
assert.equal(
  (
    await route.PATCH(
      request("PATCH", { ...edit, cantidadAnterior: 2, cantidad: 5 }),
    )
  ).status,
  409,
);
failMovement = false;
assert.deepEqual(state, beforeFailedEdit);
user = { id: 7, rol: { nombre: "Administrador", permisos: [] } };
const beforeForbiddenDelete = structuredClone(state);
assert.equal((await route.DELETE()).status, 405);
assert.deepEqual(state, beforeForbiddenDelete);
console.log(
  "Stock: validación, permisos, acumulación, lotes, ubicaciones, trazabilidad, rollback, métricas, búsqueda y paginación verificados.",
);

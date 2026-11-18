// Dashboard calculations with isolated fixtures; no database writes.
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
const summary = load("../src/lib/dashboard-summary.ts");
const dates = load("../src/lib/private/stock-dates.ts");
const sale = (id, dia, total, metodo = "EFECTIVO", cantidad = 1) => ({
  id,
  dia,
  fecha: `${dia}T15:00:00Z`,
  total,
  metodo,
  items: [{ medicamentoId: 1, nombre: "Producto", cantidad, subtotal: total }],
});
const data = {
  hoy: "2026-11-18",
  ventas: [
    sale(1, "2026-11-18", 1000),
    sale(2, "2026-11-17", 2000, "DEBITO", 3),
    sale(3, "2026-11-04", 3000),
    sale(4, "2026-09-01", 9000),
  ],
};
const result = summary.dashboardSummary(data, 14);
assert.equal(result.total, 3000);
assert.equal(result.previousTotal, 3000);
assert.equal(result.average, 1500);
assert.equal(result.daily.length, 14);
assert.equal(result.daily[0].dia, "2026-11-05");
assert.equal(result.daily.at(-1).dia, "2026-11-18");
assert.equal(
  result.daily.reduce((sum, day) => sum + day.total, 0),
  result.total,
);
assert.equal(
  result.payments.reduce((sum, payment) => sum + payment.total, 0),
  result.total,
);
assert.equal(result.top[0].cantidad, 4);
assert.equal(result.top[0].total, 3000);
assert.equal(summary.dashboardSummary(data, 7).previousTotal, 0);
assert.equal(summary.dashboardSummary(data, 30).total, 6000);
const empty = summary.dashboardSummary({ ...data, ventas: [] }, 30);
assert.equal(empty.total, 0);
assert.equal(empty.average, 0);
assert.equal(empty.top.length, 0);
assert.equal(empty.daily.length, 30);
assert.equal(summary.panelDay("2027-01-01", -1), "2026-12-31");
assert.equal(summary.panelDay("2027-09-05", 1), "2027-09-06");
const today = dates.stockDate(new Date());
const future = (days) => dates.stockExpiry(summary.panelDay(today, days));
let saleOptions;
const db = {
  venta: {
    findMany: async (options) => {
      saleOptions = options;
      return [
        {
          id: 1,
          creadaEn: new Date(),
          total: "1500",
          metodoPago: "EFECTIVO",
          detalles: [
            {
              medicamentoId: 1,
              medicamento: { nombre: "Producto" },
              cantidad: 2,
              subtotal: "1500",
            },
          ],
        },
      ];
    },
  },
  medicamento: {
    findMany: async () => [
      {
        id: 1,
        nombre: "Producto",
        activo: true,
        stockMinimo: 20,
        lotes: [
          {
            id: 1,
            numeroLote: "VIGENTE",
            fechaVencimiento: future(40),
            stocks: [{ cantidad: 6 }],
          },
          {
            id: 2,
            numeroLote: "CERCANO",
            fechaVencimiento: future(1),
            stocks: [{ cantidad: 2 }, { cantidad: 2 }],
          },
          {
            id: 3,
            numeroLote: "VENCIDO",
            fechaVencimiento: future(-1),
            stocks: [{ cantidad: 3 }],
          },
        ],
      },
      {
        id: 2,
        nombre: "Inactivo",
        activo: false,
        stockMinimo: 200,
        lotes: [
          {
            id: 4,
            numeroLote: "INACTIVO",
            fechaVencimiento: future(40),
            stocks: [{ cantidad: 100 }],
          },
        ],
      },
    ],
  },
};
const server = load("../src/lib/private/dashboard.ts", {
  "server-only": {},
  "@/lib/db/prisma-privada": { prismaPrivada: db },
  "@/lib/private/stock-dates": dates,
  "@/lib/dashboard-summary": summary,
});
const snapshot = await server.dashboardSnapshot();
assert.equal(snapshot.productos, 2);
assert.equal(snapshot.activos, 1);
assert.equal(
  snapshot.disponibles,
  10,
  "Exclude expired and inactive products from available units.",
);
assert.deepEqual(snapshot.inventario, { vigente: 106, proximo: 4, vencido: 3 });
assert.equal(snapshot.bajos.length, 1);
assert.equal(snapshot.bajos[0].cantidad, 10);
assert.equal(
  snapshot.vencimientos.length,
  2,
  "Count lots rather than locations.",
);
assert.equal(snapshot.vencimientos[0].dias, -1);
assert.equal(snapshot.vencimientos[1].dias, 1);
assert.equal(snapshot.ventas[0].total, 1500);
assert.equal(snapshot.ventas[0].items[0].subtotal, 1500);
assert.equal(
  dates.stockDate(saleOptions.where.creadaEn.gte),
  summary.panelDay(today, -59),
);
console.log(
  "Panel: períodos, comparación, días vacíos, pagos, productos, fechas chilenas e inventario verificados.",
);

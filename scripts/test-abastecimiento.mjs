// Reglas de compras, devoluciones, retiro de mercado y caja: sin base de datos.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(path) {
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
    (name) =>
      name === "@/lib/validation/user-fields"
        ? load("../src/lib/validation/user-fields.ts")
        : require(name),
    result,
    result.exports,
  );
  return result.exports;
}
const v = load("../src/lib/validation/abastecimiento.ts");

// Orden de compra
const orden = (items) =>
  v.ordenCompraSchema.safeParse({ proveedorId: 1, items });
assert.ok(
  orden([{ medicamentoId: 1, cantidad: 10, costoUnitario: 990 }]).success,
);
assert.match(orden([]).error.issues[0].message, /al menos un producto/);
assert.match(
  orden([
    { medicamentoId: 1, cantidad: 1, costoUnitario: 1 },
    { medicamentoId: 1, cantidad: 2, costoUnitario: 1 },
  ]).error.issues[0].message,
  /repetidos/,
);
assert.equal(
  orden([{ medicamentoId: 1, cantidad: 0, costoUnitario: 1 }]).success,
  false,
);

// Recepción
const rec = (l) =>
  v.recepcionSchema.safeParse({
    ubicacionId: 1,
    lineas: [{ itemId: 1, ...l }],
  });
assert.ok(
  rec({
    aceptada: 5,
    numeroLote: "L1",
    vencimiento: "2028-01-01",
    rechazada: 0,
  }).success,
);
assert.match(
  rec({ aceptada: 5, rechazada: 0 }).error.issues[0].message,
  /lote y vencimiento/,
);
assert.match(
  rec({ aceptada: 0, rechazada: 2 }).error.issues[0].message,
  /motivo/,
);
assert.ok(rec({ aceptada: 0, rechazada: 2, motivoRechazo: "DANO" }).success);
assert.match(
  rec({ aceptada: 0, rechazada: 0 }).error.issues[0].message,
  /al menos una cantidad/,
);

// Devolución y retiro
assert.match(
  v.devolucionSchema.safeParse({ proveedorId: 1, motivo: "VENCIDO" }).error
    .issues[0].message,
  /al menos un producto/,
);
assert.ok(
  v.devolucionSchema.safeParse({
    proveedorId: 1,
    motivo: "RECHAZADO",
    rechazoIds: [3],
  }).success,
);
assert.match(
  v.alertaRetiroSchema.safeParse({
    resolucion: "ISP 1",
    fecha: "2026-11-27",
    medicamentoId: 1,
    lotes: [],
    motivo: "Calidad",
  }).error.issues[0].message,
  /al menos un lote/,
);

// Proveedor
assert.ok(
  v.proveedorSchema.safeParse({
    rut: "76.543.210-3",
    razonSocial: "Droguería Uno",
  }).success,
);
assert.match(
  v.proveedorSchema.safeParse({
    rut: "76.543.210-0",
    razonSocial: "Droguería Uno",
  }).error.issues[0].message,
  /RUT/,
);

// Caja
assert.equal(
  v.efectivoEsperado({
    montoInicial: 20000,
    ventasEfectivo: 1990,
    ingresos: 5000,
    egresos: 3000,
  }),
  23990,
);
assert.equal(
  v.efectivoEsperado({
    montoInicial: 0.1,
    ventasEfectivo: 0.2,
    ingresos: 0,
    egresos: 0,
  }),
  0.3,
);
assert.match(
  v.movimientoCajaSchema.safeParse({ tipo: "EGRESO", monto: 0, motivo: "x" })
    .error.issues[0].message,
  /mayor que cero/,
);

console.log("Reglas de abastecimiento y caja: OK");

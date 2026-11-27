// Exercises the running application on port 3000. Creates and removes only its own fixtures.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import pg from "pg";
import ts from "typescript";

dotenv.config({ quiet: true });
const require = createRequire(import.meta.url);
function load(file) {
  const code = ts.transpileModule(
    readFileSync(new URL(file, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", code)(
    require,
    loaded,
    loaded.exports,
  );
  return loaded.exports;
}
const { expiryDay, allocateFefo, aptStock } = load("../src/lib/fefo.ts");
assert.equal(expiryDay("31/02/2027"), null);
assert.equal(expiryDay("01/12/2027"), "2027-12-01");
assert.equal(expiryDay("12/2027"), null);
const tie = allocateFefo(
  [
    {
      stockId: 2,
      loteId: 2,
      medicamentoId: 1,
      vencimiento: "2027-12-01",
      recepcion: "2026-10-02",
      disponible: 1,
    },
    {
      stockId: 1,
      loteId: 1,
      medicamentoId: 1,
      vencimiento: "2027-12-01",
      recepcion: "2026-10-01",
      disponible: 1,
    },
  ],
  [{ medicamentoId: 1, cantidad: 1 }],
);
assert.equal(tie.suggested[0].stockId, 1);
const stock = {
  cantidad: 1,
  fechaRecepcion: "2026-01-01",
  lote: {
    numeroLote: "A",
    fechaVencimiento: "2028-01-01",
    estado: "APTO",
    precisionVencimiento: "DIA",
    rotuloVencimiento: "2028-01-01",
  },
};
for (const estado of [
  "CUARENTENA",
  "DETERIORADO",
  "RETIRADO_ALERTA",
  "PENDIENTE_REVISION",
])
  assert.equal(aptStock({ ...stock, lote: { ...stock.lote, estado } }), false);
assert.equal(aptStock({ ...stock, fechaRecepcion: null }), false);
assert.equal(
  aptStock({
    ...stock,
    lote: { ...stock.lote, precisionVencimiento: "MES_ANIO" },
  }),
  false,
);

const db = new pg.Client({
  connectionString: process.env.DATABASE_URL_PRIVADA,
});
await db.connect();
const name = `FEFO-TEST-${randomUUID()}`;
let userId, roleId, productId, branchId, locationId;
let cookie;
const rows = async (query, values = []) => (await db.query(query, values)).rows;
const first = async (query, values = []) => (await rows(query, values))[0];
async function api(path, body, method = "POST", expected = 200) {
  const response = await fetch(`http://localhost:3000/api/privada/${path}`, {
    method,
    headers: { cookie, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (expected !== null)
    assert.equal(response.status, expected, `${path}: ${JSON.stringify(data)}`);
  return { status: response.status, data };
}
try {
  roleId = (
    await first(
      'INSERT INTO "Rol" (nombre,permisos) VALUES ($1,$2) RETURNING id',
      [
        name,
        [
          "pos",
          "inicio",
          "ventas",
          "caja",
          "indicadores",
          "inventario",
          "inventario_configurar",
          "inventario_liberar",
          "ventas_anular",
          "devoluciones",
        ],
      ],
    )
  ).id;
  userId = (
    await first(
      'INSERT INTO "Usuario" (rut,nombre,email,password,"rolId","actualizadoEn") VALUES ($1,$1,$2,$1,$3,NOW()) RETURNING id',
      [name, `${name}@example.invalid`, roleId],
    )
  ).id;
  cookie = `farmacia_privada_session=${jwt.sign({}, process.env.JWT_SECRET, { subject: String(userId), issuer: "farmacia-privada", audience: "farmacia-privada", expiresIn: "10m" })}`;
  branchId = (
    await first(
      'INSERT INTO "Sucursal" (nombre,"alertasDias") VALUES ($1,$2) RETURNING id',
      [name, [7, 30]],
    )
  ).id;
  locationId = (
    await first(
      'INSERT INTO "UbicacionInventario" (nombre,tipo,"sucursalId") VALUES ($1,\'BODEGA\',$2) RETURNING id',
      [name, branchId],
    )
  ).id;
  productId = (
    await first(
      'INSERT INTO "Medicamento" (nombre,"precioVenta","condicionVenta","actualizadoEn") VALUES ($1,1000,\'VENTA_DIRECTA\',NOW()) RETURNING id',
      [name],
    )
  ).id;
  const metadata = await api("fefo", undefined, "GET");
  assert.ok(
    metadata.data.sucursales.some((b) => b.id === branchId),
    "Application must use the same test database",
  );
  assert.ok(
    metadata.data.ubicaciones.some(
      (b) => b.id === locationId && b.sucursalId === branchId,
    ),
    "Location must be visible with assigned branch",
  );
  const future = new Date();
  future.setUTCFullYear(future.getUTCFullYear() + 1);
  const day = (offset) =>
    new Date(future.getTime() + offset * 86400000).toISOString().slice(0, 10);
  async function receive(lot, expiry, qty, daysAgo, precision = "DIA") {
    return api(
      "fefo",
      {
        medicamentoId: productId,
        ubicacionId: locationId,
        cantidad: qty,
        numeroLote: lot,
        rotuloVencimiento: expiry,
        precisionVencimiento: precision,
        fechaFabricacion: "2025-01-01",
        fechaRecepcion: new Date(Date.now() - daysAgo * 86400000).toISOString(),
        verificado: true,
        motivo: "Recepcion de prueba aislada",
      },
      "POST",
      201,
    );
  }
  assert.equal((await receive("", day(20), 1, 1)).data.pendiente, true);
  await receive("LATER-EXPIRY", day(20), 2, 10);
  await receive("EARLIER-EXPIRY", day(1), 1, 1);
  const prepare = (qty) =>
    api("ventas/preparar", {
      sucursalId: branchId,
      items: [{ medicamentoId: productId, cantidad: qty }],
    });
  let plan = (await prepare(3)).data;
  assert.deepEqual(
    plan.sugeridos.map((l) => [l.numeroLote, l.cantidad]),
    [
      ["EARLIER-EXPIRY", 1],
      ["LATER-EXPIRY", 2],
    ],
  );
  const saleBody = (plan) => ({
    sucursalId: branchId,
    items: [
      {
        medicamentoId: productId,
        cantidad: plan.sugeridos.reduce((n, l) => n + l.cantidad, 0),
      },
    ],
    metodoPago: "DEBITO",
    claveOperacion: randomUUID(),
    totalEsperado: plan.total,
    confirmacionFisica: true,
    lotes: plan.sugeridos.map((l) => ({
      medicamentoId: productId,
      stockId: l.stockId,
      cantidad: l.cantidad,
    })),
  });
  const body = {
    ...saleBody(plan),
    descuento: 100,
    totalEsperado: plan.total - 100,
    documento: { tipo: "BOLETA" },
  };
  assert.equal(
    (await api("ventas", { ...body, confirmacionFisica: false }, "POST", 400))
      .status,
    400,
  );
  await api("ventas", { ...body, totalEsperado: 0.01 }, "POST", 409);
  const sold = (await api("ventas", body, "POST", 201)).data;
  assert.equal(
    (await api("ventas", body, "POST", 201)).data.id,
    sold.id,
    "retry must be idempotent",
  );
  await api("ventas", { ...body, documento: undefined }, "POST", 409);
  const amounts = await first(
    'SELECT "tipoDocumento", subtotal, descuento, neto, iva, total FROM "Venta" WHERE id=$1',
    [sold.id],
  );
  assert.equal(amounts.tipoDocumento, "BOLETA");
  assert.equal(Number(amounts.subtotal), plan.total);
  assert.equal(Number(amounts.descuento), body.descuento);
  assert.equal(
    Number(amounts.neto) + Number(amounts.iva),
    Number(amounts.total),
  );
  assert.equal(Number(amounts.total), body.totalEsperado);
  assert.equal(
    (
      await first(
        'SELECT count(*)::int AS n FROM "DetalleVenta" WHERE "ventaId"=$1',
        [sold.id],
      )
    ).n,
    2,
  );
  assert.equal(
    (
      await first(
        'SELECT sum(cantidad)::int AS n FROM "Stock" WHERE "loteId" IN (SELECT id FROM "Lote" WHERE "medicamentoId"=$1)',
        [productId],
      )
    ).n,
    0,
  );
  await api(
    "ventas",
    { id: sold.id, motivo: "Anulacion prueba sin devolver" },
    "PATCH",
  );
  assert.equal(
    (
      await first(
        'SELECT sum(cantidad)::int AS n FROM "Stock" WHERE "loteId" IN (SELECT id FROM "Lote" WHERE "medicamentoId"=$1)',
        [productId],
      )
    ).n,
    0,
  );
  const detail = await first(
    'SELECT id FROM "DetalleVenta" WHERE "ventaId"=$1 LIMIT 1',
    [sold.id],
  );
  await api(
    "fefo",
    {
      accion: "DEVOLVER",
      detalleVentaId: detail.id,
      ubicacionId: locationId,
      cantidad: 1,
      motivo: "Devolucion de prueba",
    },
    "PATCH",
  );
  const review = await first(
    'SELECT * FROM "RevisionInventario" WHERE "detalleVentaId"=$1',
    [detail.id],
  );
  assert.equal(review.estado, "PENDIENTE");
  await api(
    "fefo",
    {
      accion: "APROBAR",
      revisionId: review.id,
      numeroLote: "EARLIER-EXPIRY",
      rotulo: day(1),
      motivo: "No hay procedimiento habilitado",
    },
    "PATCH",
    409,
  );
  const month = await receive("MONTH", "12/2027", 3, 1, "MES_ANIO");
  assert.equal(month.data.pendiente, true);
  await api(
    "fefo",
    {
      accion: "APROBAR",
      revisionId: month.data.id,
      numeroLote: "MONTH",
      rotulo: day(1),
      motivo: "Intento de aprobar mes anio",
    },
    "PATCH",
    409,
  );
  await receive("LAST-UNIT", day(2), 1, 1);
  plan = (await prepare(1)).data;
  const race = await Promise.all([
    api("ventas", saleBody(plan), "POST", null),
    api("ventas", saleBody(plan), "POST", null),
  ]);
  assert.deepEqual(
    race.map((r) => r.status).sort(),
    [201, 409],
    "only one register may sell the last unit",
  );
  assert.equal((await prepare(1)).data.faltantes[0].cantidad, 1);
  await receive("EXPIRED", day(3), 1, 1);
  await db.query(
    'UPDATE "Lote" SET "fechaVencimiento"=NOW()-INTERVAL \'1 day\' WHERE "medicamentoId"=$1 AND "numeroLote"=\'EXPIRED\'',
    [productId],
  );
  assert.equal((await prepare(1)).data.sugeridos.length, 0);
  const expired = await first(
    'SELECT s.id FROM "Stock" s JOIN "Lote" l ON l.id=s."loteId" WHERE l."medicamentoId"=$1 AND l."numeroLote"=\'EXPIRED\'',
    [productId],
  );
  await api(
    "ventas",
    {
      ...saleBody(plan),
      claveOperacion: randomUUID(),
      lotes: [{ medicamentoId: productId, stockId: expired.id, cantidad: 1 }],
    },
    "POST",
    409,
  );
  await api(
    "fefo",
    {
      accion: "RETIRAR",
      stockId: expired.id,
      cantidadAnterior: 1,
      confirmado: true,
      motivo: "Retiro fisico de prueba",
    },
    "PATCH",
  );
  assert.equal(
    (
      await first(
        'SELECT "usuarioId" FROM "MovimientoStock" WHERE "usuarioId"=$1 AND origen=\'RETIRO_FISICO_VENCIDO\'',
        [userId],
      )
    ).usuarioId,
    userId,
  );
  await receive("EXCEPTION-FIRST", day(4), 1, 1);
  await receive("EXCEPTION-SECOND", day(5), 1, 1);
  const exceptionPlan = (await prepare(1)).data;
  const alternate = exceptionPlan.aptos.find(
    (l) => l.numeroLote === "EXCEPTION-SECOND",
  );
  const exceptionBody = {
    ...saleBody(exceptionPlan),
    tipoOperacion: "DISPENSACION",
    motivoExcepcion: "Motivo documentado de prueba",
    lotes: [
      { stockId: alternate.stockId, medicamentoId: productId, cantidad: 1 },
    ],
  };
  await api("ventas", exceptionBody, "POST", 409);
  await api(
    "fefo",
    {
      accion: "SUCURSAL",
      id: branchId,
      nombre: name,
      alertasDias: [3, 14],
      permiteExcepcion: true,
      permiteReingreso: false,
      procedimiento: "Procedimiento temporal solo para prueba",
    },
    "PATCH",
  );
  await api("ventas", exceptionBody, "POST", 409);
  await db.query(
    "UPDATE \"Rol\" SET permisos=array_append(permisos,'fefo_excepcion') WHERE id=$1",
    [roleId],
  );
  await api("ventas", { ...exceptionBody, motivoExcepcion: "" }, "POST", 409);
  await api("ventas", exceptionBody, "POST", 201);
  const blocked = exceptionPlan.aptos.find(
    (l) => l.numeroLote === "EXCEPTION-FIRST",
  );
  await api(
    "fefo",
    {
      accion: "BLOQUEAR",
      loteId: blocked.loteId,
      estado: "CUARENTENA",
      motivo: "Bloqueo preventivo de prueba",
    },
    "PATCH",
  );
  assert.equal((await prepare(1)).data.faltantes[0].cantidad, 1);
  const trace = await api(`fefo?loteId=${alternate.loteId}`, undefined, "GET");
  assert.ok(
    trace.data.movimientos.some(
      (m) => m.origen === "DISPENSACION" && m.usuarioId === userId,
    ),
  );
  assert.ok(
    trace.data.stocks.some(
      (s) => s.id === alternate.stockId && s.cantidad === 0,
    ),
    "Depleted lots retain traceability",
  );
  for (const path of [
    "stocks-y-lotes",
    "auditoria-fefo",
    "punto-de-venta",
    "historial-y-reportes",
    "caja-del-dia",
    "panel",
  ]) {
    const response = await fetch(`http://localhost:3000/privada/${path}`, {
      headers: { cookie },
    });
    assert.equal(response.status, 200, `Page ${path} must compile and render`);
    const html = await response.text();
    assert.ok(
      !html.includes('"environmentName":"Server","error"'),
      `Page ${path} has a server render error`,
    );
  }
  await db.query(
    'UPDATE "Medicamento" SET "condicionVenta"=\'RECETA_SIMPLE\' WHERE id=$1',
    [productId],
  );
  await api(
    "ventas/preparar",
    {
      sucursalId: branchId,
      items: [{ medicamentoId: productId, cantidad: 1 }],
    },
    "POST",
    409,
  );
  console.log(
    "PASS: FEFO by expiry, receipt tie, split lots, physical confirmation, idempotency, concurrent last unit, expired exclusion/withdrawal audit, pending returns/month-year, cancellation without restock and prescription block.",
  );
} finally {
  if (productId) {
    await db.query(
      'DELETE FROM "RevisionInventario" WHERE "medicamentoId"=$1',
      [productId],
    );
    await db.query(
      'DELETE FROM "MovimientoStock" WHERE "loteId" IN (SELECT id FROM "Lote" WHERE "medicamentoId"=$1)',
      [productId],
    );
    await db.query('DELETE FROM "DetalleVenta" WHERE "medicamentoId"=$1', [
      productId,
    ]);
    await db.query(
      'DELETE FROM "Stock" WHERE "loteId" IN (SELECT id FROM "Lote" WHERE "medicamentoId"=$1)',
      [productId],
    );
    await db.query('DELETE FROM "Lote" WHERE "medicamentoId"=$1', [productId]);
    await db.query('DELETE FROM "Medicamento" WHERE id=$1', [productId]);
  }
  if (userId)
    await db.query('DELETE FROM "Venta" WHERE "usuarioId"=$1', [userId]);
  if (locationId)
    await db.query('DELETE FROM "UbicacionInventario" WHERE id=$1', [
      locationId,
    ]);
  if (branchId)
    await db.query('DELETE FROM "Sucursal" WHERE id=$1', [branchId]);
  if (userId) await db.query('DELETE FROM "Usuario" WHERE id=$1', [userId]);
  if (roleId) await db.query('DELETE FROM "Rol" WHERE id=$1', [roleId]);
  await db.end();
}

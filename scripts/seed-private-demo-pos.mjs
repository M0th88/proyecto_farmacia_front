import "dotenv/config";
import pg from "pg";

// Productos ficticios para ensayar el flujo completo sin asignar una condición
// de venta sanitaria a los medicamentos genéricos del catálogo.
const products = [
  {
    code: "DEMO-POS-001",
    name: "DEMO · Producto de prueba A",
    price: 3990,
    lotes: [
      { sufijo: "CORTO", dias: 14, cantidad: 5 },
      { sufijo: "LARGO", dias: 180, cantidad: 15 },
    ],
  },
  {
    code: "DEMO-POS-002",
    name: "DEMO · Producto de prueba B",
    price: 5990,
    lotes: [{ sufijo: "LARGO", dias: 180, cantidad: 12 }],
  },
  {
    code: "DEMO-POS-003",
    name: "DEMO · Producto de prueba C",
    price: 2490,
    lotes: [{ sufijo: "LARGO", dias: 180, cantidad: 30 }],
  },
];

if (!process.env.DATABASE_URL_PRIVADA)
  throw new Error("Falta DATABASE_URL_PRIVADA en .env.");
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL_PRIVADA,
});
await client.connect();
try {
  await client.query("BEGIN");
  const sucursal = await client.query(
    `INSERT INTO "Sucursal" ("nombre", "configuradaEn")
     VALUES ('Sucursal demo POS', NOW())
     ON CONFLICT ("nombre") DO NOTHING
     RETURNING id`,
  );
  const sucursalId =
    sucursal.rows[0]?.id ??
    (
      await client.query('SELECT id FROM "Sucursal" WHERE "nombre" = $1', [
        "Sucursal demo POS",
      ])
    ).rows[0].id;
  await client.query("SELECT pg_advisory_xact_lock($1, $2)", [
    20572,
    sucursalId,
  ]);
  const location = await client.query(
    `INSERT INTO "UbicacionInventario" ("nombre", "tipo", "sucursalId", "creadoEn")
     SELECT 'Vitrina de pruebas FEFO', 'VITRINA', $1, NOW()
     WHERE NOT EXISTS (SELECT 1 FROM "UbicacionInventario" WHERE "nombre" = 'Vitrina de pruebas FEFO' AND "sucursalId" = $1)
     RETURNING id`,
    [sucursalId],
  );
  const locationId =
    location.rows[0]?.id ??
    (
      await client.query(
        'SELECT id FROM "UbicacionInventario" WHERE "nombre" = $1 AND "sucursalId" = $2 ORDER BY id LIMIT 1',
        ["Vitrina de pruebas FEFO", sucursalId],
      )
    ).rows[0].id;

  let lotesCreados = 0;
  for (const item of products) {
    const existing = await client.query(
      'SELECT id, "fuenteCatalogo" FROM "Medicamento" WHERE "codigoCatalogo" = $1',
      [item.code],
    );
    if (existing.rows[0] && existing.rows[0].fuenteCatalogo !== "demo-pos")
      throw new Error(
        `El código ${item.code} pertenece a un producto ajeno a la prueba.`,
      );
    const medicineId =
      existing.rows[0]?.id ??
      (
        await client.query(
          `INSERT INTO "Medicamento" ("codigoCatalogo", "codigoBarra", "nombre", "fuenteCatalogo", "precioVenta", "condicionVenta", "stockMinimo", "activo", "creadoEn", "actualizadoEn")
       VALUES ($1, $1, $2, 'demo-pos', $3, 'VENTA_DIRECTA', 3, true, NOW(), NOW()) RETURNING id`,
          [item.code, item.name, item.price],
        )
      ).rows[0].id;
    for (const lote of item.lotes) {
      const resultado = await client.query(
        `WITH fecha AS (
           SELECT (NOW() AT TIME ZONE 'America/Santiago')::date + $3::integer AS vencimiento
         ), lote AS (
           INSERT INTO "Lote" ("numeroLote", "medicamentoId", "fechaVencimiento", "rotuloVencimiento", "precisionVencimiento", "estado")
           SELECT $1, $2, (((vencimiento + 1)::timestamp - INTERVAL '1 millisecond')
             AT TIME ZONE 'America/Santiago') AT TIME ZONE 'UTC',
             TO_CHAR(vencimiento, 'DD/MM/YYYY'), 'DIA', 'APTO'
           FROM fecha
           ON CONFLICT ("medicamentoId", "numeroLote") DO NOTHING
           RETURNING id
         ), stock AS (
           INSERT INTO "Stock" ("cantidad", "loteId", "ubicacionId", "fechaRecepcion")
           SELECT $4, id, $5, NOW() FROM lote
           RETURNING "loteId"
         )
         INSERT INTO "MovimientoStock" ("tipo", "cantidad", "motivo", "ubicacionId", "loteId", "origen")
         SELECT 'ENTRADA', $4, 'Carga de stock ficticio para prueba del POS', $5, "loteId", 'DEMO_POS'
         FROM stock`,
        [
          `PRUEBA-${item.code}-${lote.sufijo}`,
          medicineId,
          lote.dias,
          lote.cantidad,
          locationId,
        ],
      );
      lotesCreados += resultado.rowCount;
    }
  }
  await client.query("COMMIT");
  console.log(
    `${lotesCreados} lotes de prueba creados. En el POS elige “Sucursal demo POS” y busca “DEMO”.`,
  );
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}

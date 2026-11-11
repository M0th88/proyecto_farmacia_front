import "dotenv/config";
import pg from "pg";

// Productos ficticios para ensayar el flujo completo sin asignar una condición
// de venta sanitaria a los medicamentos genéricos del catálogo.
const products = [
  {
    code: "DEMO-POS-001",
    name: "DEMO · Producto de prueba A",
    price: 3990,
    stock: 20,
  },
  {
    code: "DEMO-POS-002",
    name: "DEMO · Producto de prueba B",
    price: 5990,
    stock: 12,
  },
  {
    code: "DEMO-POS-003",
    name: "DEMO · Producto de prueba C",
    price: 2490,
    stock: 30,
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
  const location = await client.query(
    `INSERT INTO "UbicacionInventario" ("nombre", "tipo", "creadoEn")
     SELECT 'Vitrina demo POS', 'VITRINA', NOW()
     WHERE NOT EXISTS (SELECT 1 FROM "UbicacionInventario" WHERE "nombre" = 'Vitrina demo POS')
     RETURNING id`,
  );
  const locationId =
    location.rows[0]?.id ??
    (
      await client.query(
        'SELECT id FROM "UbicacionInventario" WHERE "nombre" = $1 ORDER BY id LIMIT 1',
        ["Vitrina demo POS"],
      )
    ).rows[0].id;

  let created = 0;
  for (const item of products) {
    const existing = await client.query(
      'SELECT id FROM "Medicamento" WHERE "codigoCatalogo" = $1',
      [item.code],
    );
    if (existing.rows.length) continue;
    const medicine = await client.query(
      `INSERT INTO "Medicamento" ("codigoCatalogo", "codigoBarra", "nombre", "fuenteCatalogo", "precioVenta", "condicionVenta", "stockMinimo", "activo", "creadoEn", "actualizadoEn")
       VALUES ($1, $1, $2, 'demo-pos', $3, 'VENTA_DIRECTA', 3, true, NOW(), NOW()) RETURNING id`,
      [item.code, item.name, item.price],
    );
    const lot = await client.query(
      `INSERT INTO "Lote" ("numeroLote", "medicamentoId", "fechaVencimiento", "creadoEn")
       VALUES ($1, $2, NOW() + INTERVAL '2 years', NOW()) RETURNING id`,
      [`LOTE-${item.code}`, medicine.rows[0].id],
    );
    await client.query(
      'INSERT INTO "Stock" ("cantidad", "loteId", "ubicacionId") VALUES ($1, $2, $3)',
      [item.stock, lot.rows[0].id, locationId],
    );
    created += 1;
  }
  await client.query("COMMIT");
  console.log(
    `${created} productos demo creados. Busca “DEMO” o escanea DEMO-POS-001 en el POS.`,
  );
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}

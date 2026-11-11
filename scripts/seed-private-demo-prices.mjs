import "dotenv/config";
import pg from "pg";

// Montos ficticios en pesos chilenos para probar el catálogo y el POS.
const prices = [
  3990, 5490, 2490, 2990, 3490, 2590, 4990, 3290, 3990, 2990, 4490, 2490, 3290,
  2990, 1990, 6990, 8990, 5490, 2990, 4490, 4990, 7490, 3990, 6990, 8490, 9990,
  8490, 7990, 2990, 3490, 2490, 3990, 8990, 4990, 5990, 6990, 12990, 11990,
  2990, 2490,
];

if (!process.env.DATABASE_URL_PRIVADA)
  throw new Error("Falta DATABASE_URL_PRIVADA en .env.");
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL_PRIVADA,
});
await client.connect();
try {
  await client.query("BEGIN");
  let updated = 0;
  for (const [index, price] of prices.entries()) {
    const code = `MED-${String(index + 1).padStart(3, "0")}`;
    const result = await client.query(
      'UPDATE "Medicamento" SET "precioVenta" = $1, "actualizadoEn" = NOW() WHERE "codigoCatalogo" = $2 AND "precioVenta" IS NULL',
      [price, code],
    );
    updated += result.rowCount;
  }
  await client.query("COMMIT");
  console.log(
    `Precios ficticios cargados en ${updated} medicamentos sin precio. Los precios existentes se conservaron.`,
  );
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}

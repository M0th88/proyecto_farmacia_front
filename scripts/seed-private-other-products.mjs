import "dotenv/config";
import pg from "pg";

const productos = [
  ["BEB-AGUA-500", "Agua mineral sin gas 500 mL", "Bebidas"],
  ["BEB-GAS-500", "Agua mineral con gas 500 mL", "Bebidas"],
  ["BEB-MANZANA-200", "Jugo de manzana 200 mL", "Bebidas"],
  ["PIEL-CREMA-200", "Crema hidratante corporal 200 mL", "Cuidado de la piel"],
  ["PIEL-MANOS-75", "Crema hidratante de manos 75 mL", "Cuidado de la piel"],
  ["PIEL-LABIOS-4", "Bálsamo labial 4 g", "Cuidado de la piel"],
  ["BUCAL-PASTA-90", "Pasta dental menta 90 g", "Higiene bucal"],
  ["BUCAL-CEPILLO", "Cepillo dental suave", "Higiene bucal"],
  ["BUCAL-HILO-50", "Hilo dental 50 m", "Higiene bucal"],
  ["BUCAL-ENJUAGUE-250", "Enjuague bucal sin alcohol 250 mL", "Higiene bucal"],
  ["HIG-JABON-250", "Jabón líquido de manos 250 mL", "Higiene personal"],
  ["HIG-CHAMPU-350", "Champú suave 350 mL", "Higiene personal"],
  ["HIG-DESODORANTE-50", "Desodorante roll-on 50 mL", "Higiene personal"],
  [
    "BEBE-TOALLITAS-80",
    "Toallitas húmedas para bebé 80 unidades",
    "Cuidado infantil",
  ],
  ["BEBE-PANALES-M", "Pañales talla M 20 unidades", "Cuidado infantil"],
  ["SOL-PROTECTOR-50", "Protector solar FPS 50 100 mL", "Protección solar"],
];

if (!process.env.DATABASE_URL_PRIVADA)
  throw new Error("Falta DATABASE_URL_PRIVADA en .env.");

const db = new pg.Client({
  connectionString: process.env.DATABASE_URL_PRIVADA,
  connectionTimeoutMillis: 5000,
  statement_timeout: 10000,
});
await db.connect();
try {
  await db.query("BEGIN");
  let creados = 0;
  for (const [codigo, nombre, categoria] of productos) {
    await db.query(
      'INSERT INTO "CategoriaMedicamento" ("nombre") VALUES ($1) ON CONFLICT ("nombre") DO NOTHING',
      [categoria],
    );
    const resultado = await db.query(
      `INSERT INTO "Medicamento"
        ("codigoCatalogo", "nombre", "categoriaId", "datosCatalogo", "condicionVenta", "actualizadoEn")
        SELECT $1, $2, c.id, '{"tipoProducto":"OTRO"}'::jsonb, 'VENTA_DIRECTA', NOW()
        FROM "CategoriaMedicamento" c
        WHERE c.nombre = $3
          AND NOT EXISTS (SELECT 1 FROM "Medicamento" m WHERE LOWER(TRIM(m.nombre)) = LOWER($2))
        ON CONFLICT ("codigoCatalogo") DO NOTHING`,
      [`OTRO-${codigo}`, nombre, categoria],
    );
    creados += resultado.rowCount;
  }
  await db.query("COMMIT");
  console.log(`${creados} productos de ejemplo añadidos a Farmacia Privada.`);
} catch (error) {
  await db.query("ROLLBACK");
  throw error;
} finally {
  await db.end();
}

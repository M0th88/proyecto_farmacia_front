// Carga de datos de demostración para Farmacia Privada.
//
//   node scripts/seed-farmacia-demo.mjs            -> muestra lo que haría (no escribe)
//   node scripts/seed-farmacia-demo.mjs --apply    -> aplica todo en una transacción
//
// Es idempotente: solo completa lo que falta y nunca reemplaza datos cargados
// a mano (precios, clasificaciones, convenios, lotes ni roles existentes).
// Los precios y lotes son ficticios; la condición de venta se toma de la
// planilla ISP ya importada en FichaMedicamentoChile.
import "dotenv/config";
import pg from "pg";

const aplicar = process.argv.includes("--apply");
const connectionString = process.env.DATABASE_URL_PRIVADA;
if (!connectionString) throw new Error("Falta DATABASE_URL_PRIVADA en .env.");

const SUCURSAL = "Sucursal demo POS";
const UBICACIONES = [
  { nombre: "Bodega central", tipo: "BODEGA" },
  { nombre: "Vitrina mostrador", tipo: "VITRINA" },
];
const CONDICION_ISP = {
  directa: "VENTA_DIRECTA",
  "receta simple": "RECETA_SIMPLE",
  "receta retenida": "RECETA_RETENIDA",
  "receta retenida con control de existencia": "RECETA_RETENIDA",
  "receta cheque": "RECETA_CHEQUE",
};
const CONVENIOS = [
  { nombre: "Isapre Colmena", tipo: "ISAPRE", porcentaje: 15 },
  { nombre: "Isapre Banmédica", tipo: "ISAPRE", porcentaje: 12 },
  { nombre: "Isapre Cruz Blanca", tipo: "ISAPRE", porcentaje: 10 },
  { nombre: "Fonasa tramo A", tipo: "FONASA", porcentaje: 15 },
  { nombre: "Fonasa tramo B", tipo: "FONASA", porcentaje: 8 },
  { nombre: "Fonasa tramo C", tipo: "FONASA", porcentaje: 6 },
  { nombre: "Fonasa tramo D", tipo: "FONASA", porcentaje: 4 },
  { nombre: "GES con copago 20 %", tipo: "GES", porcentaje: 80 },
  { nombre: "Seguro complementario MetLife", tipo: "SEGURO", porcentaje: 20 },
];
const AFILIADOS = [
  ["Camila Fuentes Rojas", "Isapre Colmena"],
  ["Matías Soto Pérez", "Isapre Colmena"],
  ["Valentina Muñoz Díaz", "Isapre Banmédica"],
  ["Benjamín Contreras Silva", "Isapre Cruz Blanca"],
  ["Francisca Morales Torres", "Fonasa tramo B"],
  ["Diego Araya Castro", "Fonasa tramo B"],
  ["Javiera Reyes Núñez", "Seguro complementario MetLife"],
  ["Tomás Herrera Vega", "Isapre Banmédica"],
  ["Isabel Cárcamo Lagos", "Fonasa tramo A"],
  ["Ricardo Navarro Peña", "Fonasa tramo C"],
  ["Gloria Ramírez Soto", "GES con copago 20 %"],
];
const PERMISOS_ROL = {
  "Químico farmacéutico": [
    "recetas",
    "controlados",
    "controlados_firmar",
    "convenios",
  ],
  Vendedor: ["recetas"],
  Cajero: ["recetas"],
};

/** RUT ficticio válido y determinista (cuerpos 15.000.001 en adelante). */
function rut(n) {
  const cuerpo = String(15_000_000 + n);
  let suma = 0;
  let factor = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const dv = 11 - (suma % 11);
  const digito = dv === 11 ? "0" : dv === 10 ? "K" : String(dv);
  return `${cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}-${digito}`;
}

/** Número estable a partir de un texto, para precios y cantidades repetibles. */
function semilla(texto) {
  let h = 2166136261;
  for (const c of texto) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return Math.abs(h);
}

const client = new pg.Client({ connectionString });
await client.connect();
const q = (sql, params) => client.query(sql, params);
const resumen = [];
const anotar = (texto) => resumen.push(texto);

try {
  await q("BEGIN ISOLATION LEVEL SERIALIZABLE");
  const tablas = new Set(
    (
      await q(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
      )
    ).rows.map((r) => r.table_name),
  );

  // 1. Condición de venta según la planilla ISP (solo los sin clasificar).
  const sinClasificar = await q(
    `SELECT m.id, m.nombre, f."condicionVentaIsp" AS isp
       FROM "Medicamento" m
       JOIN "FichaMedicamentoChile" f ON f."medicamentoId" = m.id
      WHERE m."condicionVenta" = 'SIN_CLASIFICAR' AND f."condicionVentaIsp" IS NOT NULL`,
  );
  let clasificados = 0;
  for (const m of sinClasificar.rows) {
    const condicion = CONDICION_ISP[m.isp.trim().toLowerCase()];
    if (!condicion) continue;
    await q(
      `UPDATE "Medicamento" SET "condicionVenta" = $1, "actualizadoEn" = NOW() WHERE id = $2`,
      [condicion, m.id],
    );
    clasificados++;
  }
  anotar(`${clasificados} medicamentos clasificados según la planilla ISP`);

  // 2. Precios ficticios estables para los activos sin precio.
  const sinPrecio = await q(
    `SELECT id, nombre FROM "Medicamento" WHERE "precioVenta" IS NULL AND activo`,
  );
  for (const m of sinPrecio.rows) {
    const precio = 1990 + (semilla(m.nombre) % 18) * 1000; // 1.990 a 18.990
    await q(
      `UPDATE "Medicamento" SET "precioVenta" = $1,
              "stockMinimo" = GREATEST("stockMinimo", 5), "actualizadoEn" = NOW()
        WHERE id = $2`,
      [precio, m.id],
    );
  }
  anotar(`${sinPrecio.rowCount} precios ficticios asignados`);

  // 3. Sucursal y ubicaciones de bodega y vitrina.
  let sucursalId = (
    await q(`SELECT id FROM "Sucursal" WHERE nombre = $1`, [SUCURSAL])
  ).rows[0]?.id;
  if (!sucursalId) {
    sucursalId = (
      await q(
        `INSERT INTO "Sucursal" (nombre, "configuradaEn") VALUES ($1, NOW()) RETURNING id`,
        [SUCURSAL],
      )
    ).rows[0].id;
    anotar(`Sucursal «${SUCURSAL}» creada`);
  }
  const ubicacion = {};
  for (const u of UBICACIONES) {
    let id = (
      await q(
        `SELECT id FROM "UbicacionInventario" WHERE nombre = $1 AND "sucursalId" = $2`,
        [u.nombre, sucursalId],
      )
    ).rows[0]?.id;
    if (!id) {
      id = (
        await q(
          `INSERT INTO "UbicacionInventario" (nombre, tipo, "sucursalId", "creadoEn")
           VALUES ($1, $2, $3, NOW()) RETURNING id`,
          [u.nombre, u.tipo, sucursalId],
        )
      ).rows[0].id;
      anotar(`Ubicación «${u.nombre}» (${u.tipo}) creada`);
    }
    ubicacion[u.tipo] = id;
  }

  // 4. Lotes con stock en bodega y vitrina para los productos sin existencias.
  const sinStock = await q(
    `SELECT m.id, m.nombre FROM "Medicamento" m
      WHERE m.activo AND m."precioVenta" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM "Stock" s JOIN "Lote" l ON l.id = s."loteId"
          WHERE l."medicamentoId" = m.id AND s.cantidad > 0)
      ORDER BY m.id`,
  );
  let lotes = 0;
  for (const [i, m] of sinStock.rows.entries()) {
    const s = semilla(m.nombre);
    const planes = [
      // Lote principal: vence en 6 a 24 meses.
      {
        sufijo: "A",
        dias: 180 + (s % 540),
        bodega: 20 + (s % 60),
        vitrina: 4 + (s % 16),
      },
    ];
    // Algunos productos tienen un lote por vencer para probar FEFO y alertas.
    if (i % 5 === 0)
      planes.push({ sufijo: "B", dias: 12 + (s % 18), bodega: 0, vitrina: 6 });
    // Algunos quedan con poco stock para probar la alerta de stock mínimo.
    if (i % 7 === 3) {
      planes[0].bodega = 0;
      planes[0].vitrina = 2;
    }
    for (const p of planes) {
      for (const [tipo, cantidad] of [
        ["BODEGA", p.bodega],
        ["VITRINA", p.vitrina],
      ]) {
        if (!cantidad) continue;
        const r = await q(
          `WITH fecha AS (
             SELECT (NOW() AT TIME ZONE 'America/Santiago')::date + $3::integer AS vencimiento
           ), lote AS (
             INSERT INTO "Lote" ("numeroLote", "medicamentoId", "fechaVencimiento",
                                 "rotuloVencimiento", "precisionVencimiento", "estado")
             SELECT $1, $2, (((vencimiento + 1)::timestamp - INTERVAL '1 millisecond')
               AT TIME ZONE 'America/Santiago') AT TIME ZONE 'UTC',
               TO_CHAR(vencimiento, 'DD/MM/YYYY'), 'DIA', 'APTO'
             FROM fecha
             ON CONFLICT ("medicamentoId", "numeroLote")
               DO UPDATE SET "numeroLote" = EXCLUDED."numeroLote"
             RETURNING id
           ), stock AS (
             INSERT INTO "Stock" (cantidad, "loteId", "ubicacionId", "fechaRecepcion")
             SELECT $4, id, $5, NOW() FROM lote
             ON CONFLICT ("loteId", "ubicacionId") DO NOTHING
             RETURNING "loteId"
           )
           INSERT INTO "MovimientoStock" (tipo, cantidad, motivo, "ubicacionId", "loteId", origen)
           SELECT 'ENTRADA', $4, 'Carga inicial de datos de demostración', $5, "loteId", 'DEMO_SEED'
           FROM stock`,
          [`DEMO-${m.id}-${p.sufijo}`, m.id, p.dias, cantidad, ubicacion[tipo]],
        );
        lotes += r.rowCount;
      }
    }
  }
  anotar(
    `${lotes} existencias creadas en ${sinStock.rowCount} productos sin stock`,
  );

  // 5. Convenios y clientes afiliados (si la tabla existe).
  if (tablas.has("ConvenioDescuento")) {
    let nuevos = 0;
    for (const c of CONVENIOS) {
      const r = await q(
        `INSERT INTO "ConvenioDescuento" (nombre, tipo, porcentaje, activo, "creadoEn")
         VALUES ($1, $2, $3, true, NOW()) ON CONFLICT (nombre) DO NOTHING`,
        [c.nombre, c.tipo, c.porcentaje],
      );
      nuevos += r.rowCount;
    }
    let afiliados = 0;
    for (const [i, [nombre, convenio]] of AFILIADOS.entries()) {
      const r = await q(
        `INSERT INTO "ClienteConvenio" (rut, nombre, "convenioId", "creadoEn")
         SELECT $1, $2, id, NOW() FROM "ConvenioDescuento" WHERE nombre = $3
         ON CONFLICT (rut) DO NOTHING`,
        [rut(i + 1), nombre, convenio],
      );
      afiliados += r.rowCount;
    }
    anotar(`${nuevos} convenios y ${afiliados} clientes afiliados creados`);
  }

  // 5b. Proveedores y marcas de ejemplo (si las tablas existen).
  if (tablas.has("Proveedor")) {
    let nuevos = 0;
    for (const [i, [razon, fantasia, contacto]] of [
      ["Droguería Sur Austral SpA", "DroguSur", "Paula Henríquez"],
      [
        "Distribuidora Farmacéutica Araucanía Ltda.",
        "FarmaAraucanía",
        "Jorge Lagos",
      ],
      ["Laboratorio Andino S.A.", "Lab Andino", "Marcela Soto"],
    ].entries())
      nuevos += (
        await q(
          `INSERT INTO "Proveedor" (rut, "razonSocial", "nombreFantasia", contacto, telefono, email, activo, "creadoEn", "actualizadoEn")
           VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW()) ON CONFLICT (rut) DO NOTHING`,
          [
            rut(900 + i),
            razon,
            fantasia,
            contacto,
            `+5645${2200000 + i}`,
            `ventas${i + 1}@proveedor.test`,
          ],
        )
      ).rowCount;
    anotar(`${nuevos} proveedores de ejemplo creados`);
  }
  if (tablas.has("Marca")) {
    let nuevas = 0;
    for (const [nombre, laboratorio, pais] of [
      ["Laboratorio Chile", "Laboratorio Chile S.A.", "Chile"],
      ["Saval", "Laboratorios Saval S.A.", "Chile"],
      ["Andrómaco", "Laboratorios Andrómaco S.A.", "Chile"],
      ["Genérico", null, null],
    ])
      nuevas += (
        await q(
          `INSERT INTO "Marca" (nombre, laboratorio, pais, activo, "creadoEn")
           VALUES ($1, $2, $3, true, NOW()) ON CONFLICT (nombre) DO NOTHING`,
          [nombre, laboratorio, pais],
        )
      ).rowCount;
    anotar(`${nuevas} marcas de ejemplo creadas`);
  }

  // 6. Permisos nuevos para los roles existentes (solo se agregan).
  for (const [rol, permisos] of Object.entries(PERMISOS_ROL)) {
    const r = await q(
      `UPDATE "Rol" SET permisos = ARRAY(
         SELECT DISTINCT unnest(permisos || $2::text[]))
       WHERE nombre = $1 AND NOT (permisos @> $2::text[])`,
      [rol, permisos],
    );
    if (r.rowCount) anotar(`Rol «${rol}»: permisos ${permisos.join(", ")}`);
  }

  // 7. Apertura del libro de controlados con el stock actual.
  if (tablas.has("RegistroControlado")) {
    const r = await q(
      `INSERT INTO "RegistroControlado" ("medicamentoId", tipo, cantidad, saldo, detalle, "creadoEn")
       SELECT m.id, 'APERTURA', t.total, t.total, 'Apertura con la carga inicial de demostración', NOW()
         FROM "Medicamento" m
         CROSS JOIN LATERAL (
           SELECT COALESCE(SUM(s.cantidad), 0)::int AS total
             FROM "Stock" s JOIN "Lote" l ON l.id = s."loteId"
            WHERE l."medicamentoId" = m.id) t
        WHERE m."condicionVenta" IN ('RECETA_RETENIDA', 'RECETA_CHEQUE')
          AND NOT EXISTS (SELECT 1 FROM "RegistroControlado" r WHERE r."medicamentoId" = m.id)`,
    );
    anotar(`${r.rowCount} libros de controlados abiertos`);
  }

  if (aplicar) {
    await q("COMMIT");
    console.log("Datos de demostración aplicados:");
  } else {
    await q("ROLLBACK");
    console.log("Simulación (no se guardó nada). Usa --apply para aplicar:");
  }
  for (const linea of resumen) console.log(`  · ${linea}`);
} catch (error) {
  await q("ROLLBACK").catch(() => {});
  throw error;
} finally {
  await client.end();
}

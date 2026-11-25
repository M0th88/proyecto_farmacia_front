BEGIN;

-- Identificador de origen separado del código de barras real del producto.
ALTER TABLE "Medicamento"
ADD COLUMN "codigoCatalogo" TEXT,
ADD COLUMN "datosCatalogo" JSONB;

CREATE UNIQUE INDEX "Medicamento_codigoCatalogo_key" ON "Medicamento"("codigoCatalogo");

CREATE TYPE "MetodoPago" AS ENUM ('EFECTIVO', 'DEBITO', 'CREDITO', 'TRANSFERENCIA');
CREATE TABLE "Venta" (
  "id" SERIAL PRIMARY KEY,
  "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metodoPago" "MetodoPago" NOT NULL,
  "total" DECIMAL(12,2) NOT NULL,
  "recibido" DECIMAL(12,2),
  "vuelto" DECIMAL(12,2)
);
CREATE TABLE "DetalleVenta" (
  "id" SERIAL PRIMARY KEY,
  "ventaId" INTEGER NOT NULL REFERENCES "Venta"("id"),
  "medicamentoId" INTEGER NOT NULL REFERENCES "Medicamento"("id"),
  "loteId" INTEGER NOT NULL REFERENCES "Lote"("id"),
  "cantidad" INTEGER NOT NULL,
  "precioUnitario" DECIMAL(12,2) NOT NULL,
  "subtotal" DECIMAL(12,2) NOT NULL
);
CREATE INDEX "Venta_creadaEn_idx" ON "Venta"("creadaEn");
CREATE INDEX "DetalleVenta_ventaId_idx" ON "DetalleVenta"("ventaId");
CREATE INDEX "DetalleVenta_medicamentoId_idx" ON "DetalleVenta"("medicamentoId");
CREATE INDEX "DetalleVenta_loteId_idx" ON "DetalleVenta"("loteId");

ALTER TABLE "Medicamento" ADD COLUMN IF NOT EXISTS "codigoCatalogo" TEXT;
ALTER TABLE "Medicamento" ADD COLUMN IF NOT EXISTS "codigoAtc" TEXT;
ALTER TABLE "Medicamento" ADD COLUMN IF NOT EXISTS "fuenteCatalogo" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Medicamento_codigoCatalogo_key" ON "Medicamento"("codigoCatalogo");

CREATE TYPE "CondicionVenta" AS ENUM ('SIN_CLASIFICAR', 'VENTA_DIRECTA', 'RECETA_SIMPLE', 'RECETA_RETENIDA', 'RECETA_CHEQUE');
ALTER TABLE "Medicamento" ADD COLUMN "condicionVenta" "CondicionVenta" NOT NULL DEFAULT 'SIN_CLASIFICAR';
ALTER TABLE "Medicamento" ADD COLUMN "stockMinimo" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Rol" ADD COLUMN "permisos" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
INSERT INTO "Rol" ("nombre", "descripcion", "permisos", "creadoEn") VALUES
('Administrador', 'Acceso completo y gestión de perfiles', ARRAY['inicio','pos','catalogo','inventario','proveedores','compras','caja','ventas','indicadores','usuarios'], NOW()),
('Químico farmacéutico', 'Supervisión de productos, stock y operación', ARRAY['inicio','pos','catalogo','inventario','proveedores','compras','caja','ventas','indicadores'], NOW()),
('Vendedor', 'Atención y venta en mostrador', ARRAY['inicio','pos','catalogo','inventario'], NOW()),
('Cajero', 'Cobros y control de caja', ARRAY['inicio','pos','caja','ventas'], NOW()),
('Bodega', 'Catálogo, lotes y reposición', ARRAY['inicio','catalogo','inventario','proveedores','compras'], NOW()),
('Compras', 'Proveedores, órdenes e inventario', ARRAY['inicio','catalogo','inventario','proveedores','compras','indicadores'], NOW())
ON CONFLICT ("nombre") DO NOTHING;

CREATE TABLE "FichaMedicamentoChile" (
  "id" SERIAL PRIMARY KEY,
  "medicamentoId" INTEGER NOT NULL UNIQUE REFERENCES "Medicamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "grupoGeneral" TEXT,
  "subgrupoFarmacologico" TEXT,
  "mecanismoResumido" TEXT,
  "atcArchivo" TEXT,
  "productoIspEjemplo" TEXT,
  "nombreFantasia" TEXT,
  "laboratorioTitular" TEXT,
  "registroIsp" TEXT,
  "estadoIsp" TEXT,
  "fuenteIsp" TEXT,
  "observaciones" TEXT,
  "condicionVentaIsp" TEXT,
  "concentracionEjemplo" TEXT,
  "formaFarmaceuticaEjemplo" TEXT,
  "viaAdministracion" TEXT,
  "tipoAlmacenamiento" TEXT,
  "condicionAlmacenamiento" TEXT,
  "actualizadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TYPE "TipoDocumentoVenta" AS ENUM ('BOLETA', 'FACTURA');

ALTER TABLE "Venta"
  ADD COLUMN IF NOT EXISTS "claveOperacion" TEXT,
  ADD COLUMN IF NOT EXISTS "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "descuento" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "neto" DECIMAL(12,2),
  ADD COLUMN "iva" DECIMAL(12,2),
  ADD COLUMN "tipoDocumento" "TipoDocumentoVenta",
  ADD COLUMN "datosFacturacion" JSONB;

ALTER TABLE "DetalleVenta" ADD COLUMN "nombreProducto" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Venta_claveOperacion_key" ON "Venta"("claveOperacion");

COMMIT;

BEGIN;

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

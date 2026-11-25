-- Existing stock remains physically unverified. Do not infer receipt dates or branches.
CREATE TABLE "Sucursal" (
 "id" SERIAL PRIMARY KEY, "nombre" TEXT NOT NULL UNIQUE,
 "alertasDias" INTEGER[] NOT NULL DEFAULT ARRAY[7,30]::INTEGER[],
 "corteMes" TEXT NOT NULL DEFAULT 'PENDIENTE', "procedimiento" TEXT,
 "permiteExcepcion" BOOLEAN NOT NULL DEFAULT false, "permiteReingreso" BOOLEAN NOT NULL DEFAULT false,
 "configuradaPor" INTEGER, "configuradaEn" TIMESTAMP(3)
);
ALTER TABLE "UbicacionInventario" ADD COLUMN "sucursalId" INTEGER REFERENCES "Sucursal"("id") ON DELETE RESTRICT;
ALTER TABLE "Lote" ADD COLUMN "rotuloVencimiento" TEXT,
 ADD COLUMN "precisionVencimiento" TEXT NOT NULL DEFAULT 'DIA',
 ADD COLUMN "estado" TEXT NOT NULL DEFAULT 'PENDIENTE_REVISION';
ALTER TABLE "Stock" ADD COLUMN "fechaRecepcion" TIMESTAMP(3);
ALTER TABLE "Venta" ADD COLUMN "sucursalId" INTEGER, ADD COLUMN "usuarioId" INTEGER,
 ADD COLUMN "tipoOperacion" TEXT NOT NULL DEFAULT 'VENTA',
 ADD COLUMN "estado" TEXT NOT NULL DEFAULT 'CONFIRMADA',
 ADD COLUMN "anuladaPor" INTEGER, ADD COLUMN "anuladaEn" TIMESTAMP(3), ADD COLUMN "motivoAnulacion" TEXT,
 ADD COLUMN "motivoExcepcion" TEXT, ADD COLUMN "claveOperacion" TEXT;
CREATE UNIQUE INDEX "Venta_claveOperacion_key" ON "Venta"("claveOperacion");
ALTER TABLE "DetalleVenta" ADD COLUMN "stockId" INTEGER, ADD COLUMN "ubicacionId" INTEGER;
ALTER TABLE "MovimientoStock" ADD COLUMN "usuarioId" INTEGER, ADD COLUMN "ubicacionId" INTEGER,
 ADD COLUMN "ventaId" INTEGER, ADD COLUMN "origen" TEXT;
CREATE TABLE "RevisionInventario" (
 "id" SERIAL PRIMARY KEY, "medicamentoId" INTEGER NOT NULL, "ubicacionId" INTEGER NOT NULL,
 "cantidad" INTEGER NOT NULL CHECK ("cantidad" > 0), "numeroLote" TEXT, "rotuloVencimiento" TEXT,
 "precisionVencimiento" TEXT NOT NULL DEFAULT 'NO_VERIFICADO', "fechaFabricacion" TIMESTAMP(3),
 "fechaRecepcion" TIMESTAMP(3) NOT NULL, "detalleVentaId" INTEGER,
 "origen" TEXT NOT NULL DEFAULT 'RECEPCION', "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
 "motivo" TEXT NOT NULL, "registradoPor" INTEGER NOT NULL, "revisadoPor" INTEGER,
 "revisadoEn" TIMESTAMP(3), "resolucion" TEXT, "stockDestinoId" INTEGER,
 "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "RevisionInventario_estado_idx" ON "RevisionInventario"("estado");
CREATE INDEX "RevisionInventario_detalleVentaId_idx" ON "RevisionInventario"("detalleVentaId");
-- Catch invalid balances at the database boundary too; existing negative balances need reconciliation.
ALTER TABLE "Stock" ADD CONSTRAINT "Stock_cantidad_no_negativa" CHECK ("cantidad" >= 0) NOT VALID;

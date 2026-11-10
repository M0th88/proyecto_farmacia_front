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

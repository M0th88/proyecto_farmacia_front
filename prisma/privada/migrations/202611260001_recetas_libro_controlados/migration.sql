-- Recetas del POS y libro digital de estupefacientes/psicotrópicos.
-- Solo agrega tablas, tipos y una columna opcional; no modifica datos existentes.

-- CreateEnum
CREATE TYPE "TipoReceta" AS ENUM ('SIMPLE', 'RETENIDA', 'CHEQUE');

-- CreateEnum
CREATE TYPE "OrigenReceta" AS ENUM ('FISICA', 'DIGITAL');

-- CreateEnum
CREATE TYPE "TipoRegistroControlado" AS ENUM ('APERTURA', 'ENTRADA', 'SALIDA', 'AJUSTE');

-- AlterTable
ALTER TABLE "DetalleVenta" ADD COLUMN     "recetaId" INTEGER;

-- CreateTable
CREATE TABLE "Receta" (
    "id" SERIAL NOT NULL,
    "tipo" "TipoReceta" NOT NULL,
    "origen" "OrigenReceta" NOT NULL,
    "folio" TEXT,
    "pacienteRut" TEXT NOT NULL,
    "pacienteNombre" TEXT NOT NULL,
    "medicoRut" TEXT NOT NULL,
    "medicoNombre" TEXT NOT NULL,
    "fechaEmision" DATE NOT NULL,
    "vigenteHasta" DATE NOT NULL,
    "observaciones" TEXT,
    "ventaId" INTEGER,
    "registradaPor" INTEGER,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Receta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistroControlado" (
    "id" SERIAL NOT NULL,
    "medicamentoId" INTEGER NOT NULL,
    "tipo" "TipoRegistroControlado" NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "saldo" INTEGER NOT NULL,
    "loteId" INTEGER,
    "recetaId" INTEGER,
    "ventaId" INTEGER,
    "usuarioId" INTEGER,
    "detalle" TEXT NOT NULL,
    "firmadoPor" INTEGER,
    "firmadoEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistroControlado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Receta_pacienteRut_idx" ON "Receta"("pacienteRut");

-- CreateIndex
CREATE INDEX "Receta_tipo_folio_idx" ON "Receta"("tipo", "folio");

-- CreateIndex
CREATE INDEX "Receta_ventaId_idx" ON "Receta"("ventaId");

-- CreateIndex
CREATE INDEX "RegistroControlado_medicamentoId_id_idx" ON "RegistroControlado"("medicamentoId", "id");

-- CreateIndex
CREATE INDEX "RegistroControlado_firmadoEn_idx" ON "RegistroControlado"("firmadoEn");

-- CreateIndex
CREATE INDEX "DetalleVenta_recetaId_idx" ON "DetalleVenta"("recetaId");

-- AddForeignKey
ALTER TABLE "DetalleVenta" ADD CONSTRAINT "DetalleVenta_recetaId_fkey" FOREIGN KEY ("recetaId") REFERENCES "Receta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receta" ADD CONSTRAINT "Receta_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroControlado" ADD CONSTRAINT "RegistroControlado_medicamentoId_fkey" FOREIGN KEY ("medicamentoId") REFERENCES "Medicamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroControlado" ADD CONSTRAINT "RegistroControlado_recetaId_fkey" FOREIGN KEY ("recetaId") REFERENCES "Receta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroControlado" ADD CONSTRAINT "RegistroControlado_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

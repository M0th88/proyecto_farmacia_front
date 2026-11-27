-- Reconstruida a partir de la base compartida: esta migración se aplicó el
-- 2026-11-11 pero su archivo nunca se subió al repositorio. Reproduce la
-- misma estructura para que las bases nuevas queden iguales.

-- CreateTable
CREATE TABLE "ConvenioDescuento" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "porcentaje" DECIMAL NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConvenioDescuento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClienteConvenio" (
    "id" SERIAL NOT NULL,
    "rut" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "convenioId" INTEGER NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClienteConvenio_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Venta" ADD COLUMN "clienteRut" TEXT,
ADD COLUMN "convenioNombre" TEXT,
ADD COLUMN "descuentoPorcentaje" DECIMAL NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "ConvenioDescuento_nombre_key" ON "ConvenioDescuento"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "ClienteConvenio_rut_key" ON "ClienteConvenio"("rut");

-- CreateIndex
CREATE INDEX "ClienteConvenio_convenioId_idx" ON "ClienteConvenio"("convenioId");

-- AddForeignKey
ALTER TABLE "ClienteConvenio" ADD CONSTRAINT "ClienteConvenio_convenioId_fkey" FOREIGN KEY ("convenioId") REFERENCES "ConvenioDescuento"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

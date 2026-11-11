-- Identificador de origen separado del código de barras real del producto.
ALTER TABLE "Medicamento"
ADD COLUMN "codigoCatalogo" TEXT,
ADD COLUMN "datosCatalogo" JSONB;

CREATE UNIQUE INDEX "Medicamento_codigoCatalogo_key" ON "Medicamento"("codigoCatalogo");

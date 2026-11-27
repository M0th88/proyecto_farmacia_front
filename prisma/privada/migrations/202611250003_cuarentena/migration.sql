BEGIN;

ALTER TABLE "Stock" ADD COLUMN "cantidadBloqueada" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Stock" ADD CONSTRAINT "Stock_cantidadBloqueada_check"
  CHECK ("cantidadBloqueada" >= 0 AND ("cantidadBloqueada" = 0 OR "cantidadBloqueada" <= "cantidad"));

CREATE TABLE "CasoCuarentena" (
  "id" SERIAL PRIMARY KEY,
  "stockId" INTEGER NOT NULL REFERENCES "Stock"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "tipo" TEXT NOT NULL CHECK ("tipo" IN ('SANITARIA', 'TRANSITORIA')),
  "cantidad" INTEGER NOT NULL CHECK ("cantidad" > 0),
  "motivo" TEXT NOT NULL,
  "registradoPor" INTEGER NOT NULL,
  "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolucion" TEXT,
  "motivoResolucion" TEXT,
  "resueltoPor" INTEGER,
  "resueltoEn" TIMESTAMP(3)
);
CREATE INDEX "CasoCuarentena_tipo_resueltoEn_idx" ON "CasoCuarentena"("tipo", "resueltoEn");
CREATE INDEX "CasoCuarentena_stockId_idx" ON "CasoCuarentena"("stockId");

COMMIT;

-- FEFO y Documentos POS se aplicaron por separado en algunas bases.
-- Conserva la columna de Documentos POS mientras FEFO crea la suya.
DO $$
BEGIN
  IF to_regclass('"Sucursal"') IS NULL AND EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = '"Venta"'::regclass
      AND attname = 'claveOperacion'
      AND NOT attisdropped
  ) THEN
    ALTER TABLE "Venta" RENAME COLUMN "claveOperacion" TO "claveOperacionAnterior";
    ALTER INDEX IF EXISTS "Venta_claveOperacion_key" RENAME TO "Venta_claveOperacionAnterior_key";
  END IF;
END $$;

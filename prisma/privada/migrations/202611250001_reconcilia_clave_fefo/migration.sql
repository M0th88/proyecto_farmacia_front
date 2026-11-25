DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid = '"Venta"'::regclass
      AND attname = 'claveOperacionAnterior'
      AND NOT attisdropped
  ) THEN
    IF EXISTS (
      SELECT 1 FROM "Venta"
      WHERE "claveOperacionAnterior" IS NOT NULL
        AND "claveOperacion" IS NOT NULL
        AND "claveOperacion" <> "claveOperacionAnterior"
    ) THEN
      RAISE EXCEPTION 'Hay claves de cobro distintas pendientes de conciliación.';
    END IF;
    UPDATE "Venta"
      SET "claveOperacion" = "claveOperacionAnterior"
      WHERE "claveOperacion" IS NULL AND "claveOperacionAnterior" IS NOT NULL;
    ALTER TABLE "Venta" DROP COLUMN "claveOperacionAnterior";
  END IF;
END $$;

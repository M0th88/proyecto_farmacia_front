ALTER TABLE "Rol" ADD COLUMN "permisos" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
INSERT INTO "Rol" ("nombre", "descripcion", "permisos", "creadoEn") VALUES
('Administrador', 'Acceso completo y gestión de perfiles', ARRAY['inicio','pos','catalogo','inventario','proveedores','compras','caja','ventas','indicadores','usuarios'], NOW()),
('Químico farmacéutico', 'Supervisión de productos, stock y operación', ARRAY['inicio','pos','catalogo','inventario','proveedores','compras','caja','ventas','indicadores'], NOW()),
('Vendedor', 'Atención y venta en mostrador', ARRAY['inicio','pos','catalogo','inventario'], NOW()),
('Cajero', 'Cobros y control de caja', ARRAY['inicio','pos','caja','ventas'], NOW()),
('Bodega', 'Catálogo, lotes y reposición', ARRAY['inicio','catalogo','inventario','proveedores','compras'], NOW()),
('Compras', 'Proveedores, órdenes e inventario', ARRAY['inicio','catalogo','inventario','proveedores','compras','indicadores'], NOW())
ON CONFLICT ("nombre") DO UPDATE SET "permisos" = EXCLUDED."permisos";

-- Abastecimiento y caja: marcas, proveedores, órdenes de compra, rechazos,
-- devoluciones, alertas de retiro de mercado y turnos de caja.
-- Solo agrega tablas y la columna opcional Medicamento.marcaId.

-- AlterTable
ALTER TABLE "Medicamento" ADD COLUMN     "marcaId" INTEGER;

-- CreateTable
CREATE TABLE "Marca" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "laboratorio" TEXT,
    "pais" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Marca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proveedor" (
    "id" SERIAL NOT NULL,
    "rut" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "nombreFantasia" TEXT,
    "contacto" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "direccion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrdenCompra" (
    "id" SERIAL NOT NULL,
    "proveedorId" INTEGER NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'BORRADOR',
    "fechaEsperada" DATE,
    "observaciones" TEXT,
    "usuarioId" INTEGER,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviadaEn" TIMESTAMP(3),
    "recibidaEn" TIMESTAMP(3),

    CONSTRAINT "OrdenCompra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrdenCompraItem" (
    "id" SERIAL NOT NULL,
    "ordenId" INTEGER NOT NULL,
    "medicamentoId" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "costoUnitario" DECIMAL(12,2) NOT NULL,
    "recibida" INTEGER NOT NULL DEFAULT 0,
    "rechazada" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OrdenCompraItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductoRechazado" (
    "id" SERIAL NOT NULL,
    "ordenId" INTEGER,
    "proveedorId" INTEGER NOT NULL,
    "medicamentoId" INTEGER NOT NULL,
    "numeroLote" TEXT,
    "cantidad" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "detalle" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "devolucionId" INTEGER,
    "usuarioId" INTEGER,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductoRechazado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DevolucionProveedor" (
    "id" SERIAL NOT NULL,
    "proveedorId" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "guia" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'EMITIDA',
    "notaCredito" TEXT,
    "montoNotaCredito" DECIMAL(12,2),
    "observaciones" TEXT,
    "usuarioId" INTEGER,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cerradaEn" TIMESTAMP(3),

    CONSTRAINT "DevolucionProveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DevolucionItem" (
    "id" SERIAL NOT NULL,
    "devolucionId" INTEGER NOT NULL,
    "medicamentoId" INTEGER NOT NULL,
    "loteId" INTEGER,
    "stockId" INTEGER,
    "cantidad" INTEGER NOT NULL,

    CONSTRAINT "DevolucionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertaRetiro" (
    "id" SERIAL NOT NULL,
    "resolucion" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "medicamentoId" INTEGER NOT NULL,
    "lotes" TEXT[],
    "motivo" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'ACTIVA',
    "usuarioId" INTEGER,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cerradaEn" TIMESTAMP(3),

    CONSTRAINT "AlertaRetiro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TurnoCaja" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "montoInicial" DECIMAL(12,2) NOT NULL,
    "abiertoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cerradoEn" TIMESTAMP(3),
    "montoContado" DECIMAL(12,2),
    "montoEsperado" DECIMAL(12,2),
    "observaciones" TEXT,

    CONSTRAINT "TurnoCaja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimientoCaja" (
    "id" SERIAL NOT NULL,
    "turnoId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "monto" DECIMAL(12,2) NOT NULL,
    "motivo" TEXT NOT NULL,
    "usuarioId" INTEGER,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimientoCaja_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Marca_nombre_key" ON "Marca"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Proveedor_rut_key" ON "Proveedor"("rut");

-- CreateIndex
CREATE INDEX "OrdenCompra_estado_idx" ON "OrdenCompra"("estado");

-- CreateIndex
CREATE INDEX "OrdenCompra_proveedorId_idx" ON "OrdenCompra"("proveedorId");

-- CreateIndex
CREATE UNIQUE INDEX "OrdenCompraItem_ordenId_medicamentoId_key" ON "OrdenCompraItem"("ordenId", "medicamentoId");

-- CreateIndex
CREATE INDEX "ProductoRechazado_estado_idx" ON "ProductoRechazado"("estado");

-- CreateIndex
CREATE INDEX "DevolucionItem_devolucionId_idx" ON "DevolucionItem"("devolucionId");

-- CreateIndex
CREATE INDEX "AlertaRetiro_estado_idx" ON "AlertaRetiro"("estado");

-- CreateIndex
CREATE INDEX "TurnoCaja_usuarioId_cerradoEn_idx" ON "TurnoCaja"("usuarioId", "cerradoEn");

-- CreateIndex
CREATE INDEX "MovimientoCaja_turnoId_idx" ON "MovimientoCaja"("turnoId");

-- AddForeignKey
ALTER TABLE "Medicamento" ADD CONSTRAINT "Medicamento_marcaId_fkey" FOREIGN KEY ("marcaId") REFERENCES "Marca"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenCompra" ADD CONSTRAINT "OrdenCompra_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenCompraItem" ADD CONSTRAINT "OrdenCompraItem_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "OrdenCompra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrdenCompraItem" ADD CONSTRAINT "OrdenCompraItem_medicamentoId_fkey" FOREIGN KEY ("medicamentoId") REFERENCES "Medicamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductoRechazado" ADD CONSTRAINT "ProductoRechazado_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "OrdenCompra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductoRechazado" ADD CONSTRAINT "ProductoRechazado_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductoRechazado" ADD CONSTRAINT "ProductoRechazado_medicamentoId_fkey" FOREIGN KEY ("medicamentoId") REFERENCES "Medicamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductoRechazado" ADD CONSTRAINT "ProductoRechazado_devolucionId_fkey" FOREIGN KEY ("devolucionId") REFERENCES "DevolucionProveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevolucionProveedor" ADD CONSTRAINT "DevolucionProveedor_proveedorId_fkey" FOREIGN KEY ("proveedorId") REFERENCES "Proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevolucionItem" ADD CONSTRAINT "DevolucionItem_devolucionId_fkey" FOREIGN KEY ("devolucionId") REFERENCES "DevolucionProveedor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevolucionItem" ADD CONSTRAINT "DevolucionItem_medicamentoId_fkey" FOREIGN KEY ("medicamentoId") REFERENCES "Medicamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertaRetiro" ADD CONSTRAINT "AlertaRetiro_medicamentoId_fkey" FOREIGN KEY ("medicamentoId") REFERENCES "Medicamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimientoCaja" ADD CONSTRAINT "MovimientoCaja_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "TurnoCaja"("id") ON DELETE CASCADE ON UPDATE CASCADE;

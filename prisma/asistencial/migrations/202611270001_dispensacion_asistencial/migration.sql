-- Dispensación asistencial: programas de salud, pacientes, entregas sin costo
-- y remesas CENABAST. Solo agrega tipos y tablas; no modifica datos existentes.

-- CreateEnum
CREATE TYPE "TipoPrograma" AS ENUM ('GES', 'CRONICO', 'OTRO');

-- CreateTable
CREATE TABLE "ProgramaSalud" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoPrograma" NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgramaSalud_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramaMedicamento" (
    "programaId" INTEGER NOT NULL,
    "medicamentoId" INTEGER NOT NULL,
    "cuotaMensual" INTEGER NOT NULL,

    CONSTRAINT "ProgramaMedicamento_pkey" PRIMARY KEY ("programaId","medicamentoId")
);

-- CreateTable
CREATE TABLE "Paciente" (
    "id" SERIAL NOT NULL,
    "rut" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "fechaNacimiento" DATE,
    "telefono" TEXT,
    "direccion" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Paciente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InscripcionPrograma" (
    "id" SERIAL NOT NULL,
    "pacienteId" INTEGER NOT NULL,
    "programaId" INTEGER NOT NULL,
    "desde" DATE NOT NULL,
    "hasta" DATE,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InscripcionPrograma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dispensacion" (
    "id" SERIAL NOT NULL,
    "claveOperacion" TEXT NOT NULL,
    "pacienteId" INTEGER NOT NULL,
    "programaId" INTEGER NOT NULL,
    "folioReceta" TEXT,
    "medicoRut" TEXT NOT NULL,
    "medicoNombre" TEXT NOT NULL,
    "fechaReceta" DATE NOT NULL,
    "retiraRut" TEXT,
    "retiraNombre" TEXT,
    "retiraParentesco" TEXT,
    "observaciones" TEXT,
    "usuarioId" INTEGER,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Dispensacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DispensacionDetalle" (
    "id" SERIAL NOT NULL,
    "dispensacionId" INTEGER NOT NULL,
    "medicamentoId" INTEGER NOT NULL,
    "loteId" INTEGER NOT NULL,
    "ubicacionId" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL,

    CONSTRAINT "DispensacionDetalle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Remesa" (
    "id" SERIAL NOT NULL,
    "guia" TEXT NOT NULL,
    "proveedor" TEXT NOT NULL DEFAULT 'CENABAST',
    "recibidaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observaciones" TEXT,
    "usuarioId" INTEGER,

    CONSTRAINT "Remesa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RemesaDetalle" (
    "id" SERIAL NOT NULL,
    "remesaId" INTEGER NOT NULL,
    "loteId" INTEGER NOT NULL,
    "ubicacionId" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL,

    CONSTRAINT "RemesaDetalle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProgramaSalud_codigo_key" ON "ProgramaSalud"("codigo");

-- CreateIndex
CREATE INDEX "ProgramaMedicamento_medicamentoId_idx" ON "ProgramaMedicamento"("medicamentoId");

-- CreateIndex
CREATE UNIQUE INDEX "Paciente_rut_key" ON "Paciente"("rut");

-- CreateIndex
CREATE INDEX "InscripcionPrograma_programaId_idx" ON "InscripcionPrograma"("programaId");

-- CreateIndex
CREATE UNIQUE INDEX "InscripcionPrograma_pacienteId_programaId_key" ON "InscripcionPrograma"("pacienteId", "programaId");

-- CreateIndex
CREATE UNIQUE INDEX "Dispensacion_claveOperacion_key" ON "Dispensacion"("claveOperacion");

-- CreateIndex
CREATE INDEX "Dispensacion_pacienteId_creadaEn_idx" ON "Dispensacion"("pacienteId", "creadaEn");

-- CreateIndex
CREATE INDEX "Dispensacion_creadaEn_idx" ON "Dispensacion"("creadaEn");

-- CreateIndex
CREATE INDEX "DispensacionDetalle_dispensacionId_idx" ON "DispensacionDetalle"("dispensacionId");

-- CreateIndex
CREATE INDEX "DispensacionDetalle_medicamentoId_idx" ON "DispensacionDetalle"("medicamentoId");

-- CreateIndex
CREATE UNIQUE INDEX "Remesa_proveedor_guia_key" ON "Remesa"("proveedor", "guia");

-- CreateIndex
CREATE INDEX "RemesaDetalle_remesaId_idx" ON "RemesaDetalle"("remesaId");

-- AddForeignKey
ALTER TABLE "ProgramaMedicamento" ADD CONSTRAINT "ProgramaMedicamento_programaId_fkey" FOREIGN KEY ("programaId") REFERENCES "ProgramaSalud"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramaMedicamento" ADD CONSTRAINT "ProgramaMedicamento_medicamentoId_fkey" FOREIGN KEY ("medicamentoId") REFERENCES "Medicamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InscripcionPrograma" ADD CONSTRAINT "InscripcionPrograma_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "Paciente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InscripcionPrograma" ADD CONSTRAINT "InscripcionPrograma_programaId_fkey" FOREIGN KEY ("programaId") REFERENCES "ProgramaSalud"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispensacion" ADD CONSTRAINT "Dispensacion_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "Paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispensacion" ADD CONSTRAINT "Dispensacion_programaId_fkey" FOREIGN KEY ("programaId") REFERENCES "ProgramaSalud"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispensacionDetalle" ADD CONSTRAINT "DispensacionDetalle_dispensacionId_fkey" FOREIGN KEY ("dispensacionId") REFERENCES "Dispensacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispensacionDetalle" ADD CONSTRAINT "DispensacionDetalle_medicamentoId_fkey" FOREIGN KEY ("medicamentoId") REFERENCES "Medicamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispensacionDetalle" ADD CONSTRAINT "DispensacionDetalle_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "Lote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemesaDetalle" ADD CONSTRAINT "RemesaDetalle_remesaId_fkey" FOREIGN KEY ("remesaId") REFERENCES "Remesa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemesaDetalle" ADD CONSTRAINT "RemesaDetalle_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "Lote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

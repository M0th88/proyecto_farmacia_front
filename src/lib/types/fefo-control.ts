export type Branch = {
  id: number;
  nombre: string;
  alertasDias: number[];
  permiteExcepcion: boolean;
  permiteReingreso: boolean;
  procedimiento: string | null;
};
export type ControlStock = {
  id: number;
  cantidad: number;
  fechaRecepcion: string | null;
  loteId: number;
  ubicacionId: number;
  lote: {
    id: number;
    numeroLote: string;
    estado: string;
    rotuloVencimiento: string | null;
    precisionVencimiento: string;
    fechaVencimiento: string;
    medicamento: {
      nombre: string;
      concentracion: string | null;
      formaFarmaceutica: string | null;
    };
  };
  ubicacion: {
    nombre: string;
    sucursalId: number | null;
    sucursal: Branch | null;
  };
};
export type Review = {
  id: number;
  medicamentoId: number;
  numeroLote: string | null;
  rotuloVencimiento: string | null;
  precisionVencimiento: string;
  cantidad: number;
  origen: string;
  estado: string;
  motivo: string;
  fechaRecepcion: string;
};
export type ControlData = {
  sucursales: Branch[];
  ubicaciones: { id: number; nombre: string; sucursalId: number | null }[];
  stocks: ControlStock[];
  revisiones: Review[];
  movimientos: {
    id: number;
    tipo: string;
    cantidad: number;
    usuarioId: number | null;
    ubicacionId: number | null;
    ventaId: number | null;
    origen: string | null;
    motivo: string | null;
    creadoEn: string;
  }[];
  permisos: {
    configurar: boolean;
    liberar: boolean;
    devolver: boolean;
    anular: boolean;
  };
};

export const tiposCuarentena = ["SANITARIA", "TRANSITORIA"] as const;
export type TipoCuarentena = (typeof tiposCuarentena)[number];
export type VistaInventario = TipoCuarentena | "SEGREGAR" | "VENCIDOS";

export type ExistenciaCuarentena = {
  id: number;
  cantidad: number;
  cantidadBloqueada: number;
  producto: string;
  lote: string;
  ubicacion: string;
  vencimiento: string | null;
  rotulo: string | null;
  vencimientoPorVerificar: boolean;
};

export type CasoCuarentena = {
  id: number;
  cantidad: number;
  motivo: string;
  registradoPor: number;
  creadoEn: string;
  resolucion: string | null;
  motivoResolucion: string | null;
  resueltoPor: number | null;
  resueltoEn: string | null;
  existencia: ExistenciaCuarentena;
};

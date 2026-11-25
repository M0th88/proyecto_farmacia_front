export type Producto = {
  id: number;
  nombre: string;
  codigoBarra: string | null;
  concentracion: string | null;
  formaFarmaceutica?: string | null;
  categoria: string;
  precio: number | null;
  stock: number;
  stockMinimo: number;
  condicionVenta:
    | "SIN_CLASIFICAR"
    | "VENTA_DIRECTA"
    | "RECETA_SIMPLE"
    | "RECETA_RETENIDA"
    | "RECETA_CHEQUE";
};

export type Item = { id: number; cantidad: number };

export const mediosPago = {
  EFECTIVO: "Efectivo",
  DEBITO: "Tarjeta de débito",
  CREDITO: "Tarjeta de crédito",
  TRANSFERENCIA: "Transferencia",
} as const;

export type MedioPago = keyof typeof mediosPago;
export type TipoDocumento = "BOLETA" | "FACTURA";
export type VentaConfirmada = {
  id: number;
  total: number;
  vuelto: number | null;
};

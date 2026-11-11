export type Producto = {
  id: number;
  nombre: string;
  codigoBarra: string | null;
  concentracion: string | null;
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

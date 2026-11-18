export type DashboardSale = {
  id: number;
  fecha: string;
  dia: string;
  total: number;
  metodo: string;
  items: {
    medicamentoId: number;
    nombre: string;
    cantidad: number;
    subtotal: number;
  }[];
};
export type DashboardData = {
  hoy: string;
  actualizado: string;
  ventas: DashboardSale[];
  productos: number;
  activos: number;
  disponibles: number;
  inventario: { vigente: number; proximo: number; vencido: number };
  bajos: { id: number; nombre: string; cantidad: number; minimo: number }[];
  vencimientos: {
    id: number;
    nombre: string;
    lote: string;
    dias: number;
    cantidad: number;
  }[];
};

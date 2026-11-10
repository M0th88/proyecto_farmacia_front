import Link from "next/link";
import { PrivateNav } from "@/components/private-nav";
import { prismaPrivada } from "@/config/prismaPrivada";
export const instant = false;

export default async function InventarioPrivado() {
  const productos = await prismaPrivada.medicamento.findMany({ orderBy: { nombre: "asc" }, include: { lotes: { include: { stocks: true }, orderBy: { fechaVencimiento: "asc" } } } });
  const ahora = new Date();
  const treintaDias = new Date(ahora.getTime()+30*24*60*60*1000);
  const filas = productos.map(p => ({ id:p.id, nombre:p.nombre, codigo:p.codigoBarra, condicion:p.condicionVenta??"SIN_CLASIFICAR", minimo:p.stockMinimo??0, precio:p.precioVenta===null?null:Number(p.precioVenta), lotes:p.lotes.map(l=>({ id:l.id, numero:l.numeroLote, vence:l.fechaVencimiento, cantidad:l.stocks.reduce((n,s)=>n+s.cantidad,0) })) }));
  const bajo = filas.filter(p=>p.minimo>0&&p.lotes.filter(l=>l.vence>ahora).reduce((n,l)=>n+l.cantidad,0)<=p.minimo).length;
  const proximos = filas.flatMap(p=>p.lotes).filter(l=>l.cantidad>0&&l.vence>ahora&&l.vence<=treintaDias).length;
  const vencidos = filas.flatMap(p=>p.lotes).filter(l=>l.cantidad>0&&l.vence<=ahora).length;
  return <main className="pos-shell"><header className="pos-header"><div><Link href="/privada">← Volver al panel</Link><p>FARMACIA PRIVADA / INVENTARIO</p><h1>Stock y vencimientos</h1><span>Productos, lotes y alertas de la base privada.</span></div></header><PrivateNav /><div className="pos-metrics"><div><small>Productos</small><strong>{filas.length}</strong></div><div><small>Stock bajo</small><strong>{bajo}</strong></div><div><small>Vencen en 30 días</small><strong>{proximos}</strong></div><div><small>Lotes vencidos</small><strong>{vencidos}</strong></div></div><section className="pos-panel"><div className="pos-title"><h2>Catálogo y lotes</h2></div>{filas.map(p=><details className="pos-sale" key={p.id}><summary><b>{p.nombre}</b><span>{p.codigo??"Sin código de barras"}</span><span>{p.condicion.replaceAll("_"," ")}</span><strong>{p.lotes.filter(l=>l.vence>ahora).reduce((n,l)=>n+l.cantidad,0)} disponibles</strong></summary><div><p>Precio: {p.precio===null?"Pendiente":new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(p.precio)} · Stock mínimo: {p.minimo}</p>{p.lotes.length?p.lotes.map(l=><p key={l.id}>Lote {l.numero} · {l.cantidad} unidades · Vence {new Intl.DateTimeFormat("es-CL",{dateStyle:"medium",timeZone:"America/Santiago"}).format(l.vence)}{l.vence<=ahora?" · VENCIDO":l.vence<=treintaDias?" · PRÓXIMO A VENCER":""}</p>):<p>Sin lotes registrados.</p>}</div></details>)}</section></main>;
}

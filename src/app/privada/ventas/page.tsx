import Link from "next/link";
import { PrivateNav } from "@/components/private-nav";
import { prismaPrivada } from "@/config/prismaPrivada";
export const instant = false;

const pesos = (n:number) => new Intl.NumberFormat("es-CL", { style:"currency", currency:"CLP", maximumFractionDigits:0 }).format(n);
export default async function VentasPrivadas() {
  const ventas = await prismaPrivada.venta.findMany({ take: 100, orderBy: { creadaEn: "desc" }, include: { detalles: { include: { medicamento: { select: { nombre: true } }, lote: { select: { numeroLote: true } } } } } });
  const total = ventas.reduce((n,v)=>n+Number(v.total),0);
  return <main className="pos-shell"><header className="pos-header"><div><Link href="/privada">← Volver al panel</Link><p>FARMACIA PRIVADA / CONTROL</p><h1>Historial de ventas</h1><span>Últimas 100 operaciones registradas · Registro interno, no boleta tributaria.</span></div></header><PrivateNav /><div className="pos-grid"><section className="pos-panel"><div className="pos-title"><h2>Operaciones recientes</h2><span>{ventas.length} ventas</span></div>{ventas.length?ventas.map(v=><details className="pos-sale" key={v.id}><summary><b>Venta #{v.id}</b><span>{new Intl.DateTimeFormat("es-CL",{dateStyle:"short",timeStyle:"short",timeZone:"America/Santiago"}).format(v.creadaEn)}</span><span>{v.metodoPago.replaceAll("_"," ")}</span><strong>{pesos(Number(v.total))}</strong></summary><div>{v.detalles.map(d=><p key={d.id}>{d.cantidad} × {d.medicamento.nombre} · Lote {d.lote.numeroLote} · {pesos(Number(d.subtotal))}</p>)}</div></details>):<p className="pos-empty">Todavía no hay ventas registradas.</p>}</section><aside className="pos-panel"><div className="pos-title"><h2>Resumen visible</h2></div><div className="pos-total"><span>Ventas listadas</span><strong>{ventas.length}</strong></div><div className="pos-total"><span>Total de estas ventas</span><strong>{pesos(total)}</strong></div><p className="pos-footnote">Este resumen no sustituye la conciliación de caja ni los documentos del SII.</p></aside></div></main>;
}

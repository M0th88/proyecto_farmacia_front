import { requirePharmacyUser } from "@/lib/auth/session";
import Link from "next/link";
import { connection } from "next/server";
import { prismaPrivada } from "@/lib/db/prisma-privada";

export const instant = false;
const pesos = (n:number) => new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(n);
const diaChile = (d:Date) => new Intl.DateTimeFormat("en-CA",{timeZone:"America/Santiago",year:"numeric",month:"2-digit",day:"2-digit"}).format(d);

export default async function IndicadoresPrivados() {
  await requirePharmacyUser("privada");
  await connection();
  const ahora = new Date();
  const ventas = await prismaPrivada.venta.findMany({where:{creadaEn:{gte:new Date(ahora.getTime()-15*24*60*60*1000)}},select:{creadaEn:true,total:true}});
  const dias = Array.from({length:14},(_,i)=>{const fecha=new Date(ahora.getTime()-(13-i)*24*60*60*1000);const clave=diaChile(fecha);const delDia=ventas.filter(v=>diaChile(v.creadaEn)===clave);return {clave,total:delDia.reduce((n,v)=>n+Number(v.total),0),tickets:delDia.length};});
  const total=dias.reduce((n,d)=>n+d.total,0);
  const tickets=dias.reduce((n,d)=>n+d.tickets,0);
  const max=Math.max(1,...dias.map(d=>d.total));
  return <section className="pos-shell"><header className="pos-header"><div><Link href="/">← Panel principal</Link><p>FARMACIA PRIVADA / ANÁLISIS</p><h1>Indicadores</h1><span>Ventas registradas durante los últimos 14 días en Chile.</span></div></header><div className="pos-metrics"><div><small>Ventas 14 días</small><strong>{pesos(total)}</strong></div><div><small>Tickets</small><strong>{tickets}</strong></div><div><small>Ticket promedio</small><strong>{pesos(tickets?total/tickets:0)}</strong></div><div><small>Días con ventas</small><strong>{dias.filter(d=>d.tickets>0).length}</strong></div></div><section className="pos-panel"><div className="pos-title"><div><small>TENDENCIA</small><h2>Ventas por día</h2></div></div><div className="indicator-chart">{dias.map(d=><div className="indicator-day" key={d.clave} title={`${d.clave}: ${pesos(d.total)} · ${d.tickets} tickets`}><span>{d.total?pesos(d.total):"—"}</span><div><i style={{height:`${Math.max(4,d.total/max*100)}%`}} /></div><small>{d.clave.slice(5)}</small></div>)}</div><p className="pos-footnote">Cifras internas del POS. Los márgenes requieren registrar costos de compra; no se estiman aquí.</p></section></section>;
}

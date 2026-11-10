import Link from "next/link";
import { PrivateNav } from "@/components/private-nav";

export default function ProveedoresPrivados() {
  return <main className="pos-shell"><header className="pos-header"><div><Link href="/">← Panel principal</Link><p>FARMACIA PRIVADA / ABASTECIMIENTO</p><h1>Proveedores</h1><span>Laboratorios y distribuidores que abastecen la farmacia.</span></div></header><PrivateNav />
    <div className="pos-grid"><section className="pos-panel"><div className="pos-title"><div><small>DIRECTORIO</small><h2>Proveedores registrados</h2></div><span>0 proveedores</span></div><div className="pos-empty"><b>Directorio pendiente de implementación</b><p>Esta vista se conectará a proveedores y órdenes de compra. No se muestran datos de demostración como si fueran reales.</p></div></section><aside className="pos-panel"><div className="pos-title"><div><small>PRÓXIMO PASO</small><h2>Ficha de proveedor</h2></div></div><div className="provider-fields"><label>Razón social<input disabled placeholder="Nombre legal" /></label><label>RUT<input disabled placeholder="RUT del proveedor" /></label><label>Contacto<input disabled placeholder="Nombre de contacto" /></label><label>Teléfono<input disabled placeholder="Teléfono" /></label><label>Correo<input disabled placeholder="Correo electrónico" /></label><label>Dirección<input disabled placeholder="Dirección comercial" /></label></div><p className="pos-footnote">El alta y edición se habilitarán al crear el modelo de proveedores y los permisos correspondientes.</p></aside></div>
  </main>;
}

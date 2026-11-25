"use client";
import { FileText, Printer, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "@/components/ui/modal";
import {
  type Item,
  type MedioPago,
  mediosPago,
  type Producto,
  type TipoDocumento,
  type VentaConfirmada,
} from "@/lib/types/punto-de-venta";
import {
  calcularTotales,
  camposFacturacion,
  type DocumentoVenta,
  type Facturacion,
  facturacionSchema,
  montoPos,
  pesos,
  tasaIva,
} from "@/lib/validation/punto-de-venta";
import { ClientesPendientes } from "./clientes-pendientes";
import { FefoConfirmation } from "./fefo-confirmation";

const facturacionVacia: Facturacion = {
  rut: "",
  razonSocial: "",
  giro: "",
  direccion: "",
  comuna: "",
  ciudad: "",
  email: "",
};

export function PuntoDeVenta() {
  const [branch, setBranch] = useState(0);
  const [branches, setBranches] = useState<{ id: number; nombre: string }[]>(
    [],
  );
  const [preparing, setPreparing] = useState<DocumentoVenta | null>(null);
  const [operation, setOperation] = useState<"VENTA" | "DISPENSACION">("VENTA");
  const [productos, setProductos] = useState<Producto[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [codigo, setCodigo] = useState("");
  const [pago, setPago] = useState<MedioPago>("EFECTIVO");
  const [pagoVerificado, setPagoVerificado] = useState(false);
  const [tipoDocumento, setTipoDocumento] = useState<TipoDocumento>("BOLETA");
  const [facturacion, setFacturacion] = useState(facturacionVacia);
  const [descuento, setDescuento] = useState("");
  const [ultimaVenta, setUltimaVenta] = useState<VentaConfirmada | null>(null);
  const [reintentar, setReintentar] = useState(false);
  const [recibido, setRecibido] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(true);
  const [cobrando, setCobrando] = useState(false);
  const bloqueado = cobrando || preparing !== null;
  const lector = useRef<HTMLInputElement>(null);
  const confirmacion = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    if (ultimaVenta) confirmacion.current?.focus();
  }, [ultimaVenta]);
  async function cargar() {
    setCargando(true);
    setPagoVerificado(false);
    try {
      const r = await fetch(`/api/privada/catalogo?sucursalId=${branch}`, {
        cache: "no-store",
      });
      if (!r.ok) throw new Error("No se pudo cargar el catálogo privado.");
      setProductos(await r.json());
    } catch (e) {
      setMensaje(e instanceof Error ? e.message : "Error de conexión.");
    } finally {
      setCargando(false);
    }
  }
  useEffect(() => {
    fetch("/api/privada/fefo?meta=1")
      .then(async (r) => {
        if (!r.ok) throw new Error("No se pudieron cargar las sucursales.");
        return r.json();
      })
      .then((d) => setBranches(d.sucursales))
      .catch((e) => setMensaje(e.message));
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/privada/catalogo?sucursalId=${branch}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error("No se pudo cargar el catálogo privado.");
        return (await r.json()) as Producto[];
      })
      .then((catalogo) => {
        if (!controller.signal.aborted) setProductos(catalogo);
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setMensaje(e instanceof Error ? e.message : "Error de conexión.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setCargando(false);
      });
    return () => controller.abort();
  }, [branch]);
  const filtrados = useMemo(
    () =>
      productos.filter((p) =>
        `${p.nombre} ${p.codigoBarra ?? ""} ${p.categoria} ${p.concentracion ?? ""}`
          .toLowerCase()
          .includes(busqueda.toLowerCase()),
      ),
    [productos, busqueda],
  );
  const lineas = items
    .map((i) => ({ ...i, producto: productos.find((p) => p.id === i.id) }))
    .filter((x): x is Item & { producto: Producto } => !!x.producto);
  const subtotal =
    lineas.reduce(
      (n, x) => n + Math.round((x.producto.precio ?? 0) * 100) * x.cantidad,
      0,
    ) / 100;
  const importeDescuento = Number(descuento || 0);
  const descuentoValido =
    montoPos.safeParse(importeDescuento).success &&
    importeDescuento <= subtotal;
  const { total, neto, iva } = calcularTotales(
    subtotal,
    descuentoValido ? importeDescuento : 0,
  );
  function agregar(p: Producto) {
    if (bloqueado) return;
    const actual = items.find((i) => i.id === p.id)?.cantidad ?? 0;
    if (p.condicionVenta !== "VENTA_DIRECTA") {
      setMensaje(
        "Este medicamento requiere clasificación o validación de receta antes de venderse.",
      );
      return;
    }
    if (p.precio === null || p.precio <= 0) {
      setMensaje("Configura el precio de este medicamento.");
      return;
    }
    if (actual >= p.stock) {
      setMensaje("No hay más unidades disponibles.");
      return;
    }
    setItems((v) =>
      actual
        ? v.map((i) => (i.id === p.id ? { ...i, cantidad: i.cantidad + 1 } : i))
        : [...v, { id: p.id, cantidad: 1 }],
    );
    setPagoVerificado(false);
    setMensaje("");
  }
  function escanear() {
    const valor = codigo.trim();
    if (!valor) return;
    const p = productos.find((x) => x.codigoBarra === valor);
    if (p) agregar(p);
    else setMensaje(`Código ${valor} no encontrado.`);
    setCodigo("");
    lector.current?.focus();
  }
  function cambiar(id: number, n: number) {
    if (bloqueado) return;
    const p = productos.find((x) => x.id === id);
    setPagoVerificado(false);
    if (n <= 0) setItems((v) => v.filter((x) => x.id !== id));
    else if (p && n <= p.stock) {
      setItems((v) => v.map((x) => (x.id === id ? { ...x, cantidad: n } : x)));
      setMensaje("");
    } else setMensaje("La cantidad supera el stock disponible.");
  }
  function cobrar() {
    if (!branch || bloqueado) return;
    if (!lineas.length || lineas.length !== items.length) {
      setMensaje(
        "Quita del carrito los productos que ya no están disponibles.",
      );
      return;
    }
    if (!montoPos.safeParse(subtotal).success || !descuentoValido) {
      setMensaje("Revisa el subtotal y el importe del descuento.");
      return;
    }
    if (
      pago === "EFECTIVO" &&
      (!recibido ||
        !montoPos.safeParse(Number(recibido)).success ||
        Number(recibido) < total)
    ) {
      setMensaje("Ingresa un importe válido que cubra el total.");
      return;
    }
    if (pago !== "EFECTIVO" && !pagoVerificado) {
      setMensaje(
        "Confirma que el pago fue recibido antes de registrar la venta.",
      );
      return;
    }
    const datos = facturacionSchema.safeParse(facturacion);
    if (tipoDocumento === "FACTURA" && !datos.success) {
      const problema = datos.error.issues[0];
      const campo = camposFacturacion.find(
        ({ nombre }) => nombre === problema?.path[0],
      );
      setMensaje(
        campo
          ? `Revisa el campo de facturación «${campo.etiqueta}».`
          : "Revisa los datos de facturación.",
      );
      return;
    }
    setPreparing(
      tipoDocumento === "FACTURA" && datos.success
        ? { tipo: tipoDocumento, facturacion: datos.data }
        : { tipo: "BOLETA" },
    );
  }
  return (
    <section className="pos-shell">
      <header className="pos-header">
        <div>
          <h1>POS</h1>
          <span>Escanea, prepara el pedido y registra el cobro.</span>
          <nav className="pos-accesos" aria-label="Accesos del POS">
            <Link href="/privada/historial-y-reportes#operaciones-recientes">
              Historial de ventas
            </Link>
            <Link href="/privada/stocks-y-lotes">Stocks y Lotes</Link>
            <Link href="/privada/caja-del-dia">Caja del Día</Link>
          </nav>
        </div>
        <button disabled={cargando || bloqueado} onClick={() => void cargar()}>
          Actualizar catálogo
        </button>
      </header>

      {mensaje && (
        <div className="pos-message" role="status">
          {mensaje}
          <button onClick={() => setMensaje("")} aria-label="Cerrar">
            ×
          </button>
        </div>
      )}
      {ultimaVenta && (
        <div className="pos-message pos-confirmacion">
          <div role="status">
            <strong>
              Venta #{ultimaVenta.id} registrada · {pesos(ultimaVenta.total)}
            </strong>
            {ultimaVenta.vuelto !== null && (
              <span> · Vuelto {pesos(ultimaVenta.vuelto)}</span>
            )}
          </div>
          <div className="pos-confirmacion-acciones">
            <Link
              ref={confirmacion}
              href={`/privada/historial-y-reportes/${ultimaVenta.id}`}
            >
              <FileText size={17} aria-hidden="true" />
              Ver documento
            </Link>
            <Link
              className="pos-imprimir"
              href={`/privada/historial-y-reportes/${ultimaVenta.id}?imprimir=1`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Imprimir (abre en otra pestaña)"
            >
              <Printer size={17} aria-hidden="true" />
              Imprimir
            </Link>
            <button
              type="button"
              onClick={() => setUltimaVenta(null)}
              aria-label="Cerrar confirmación"
            >
              <X size={17} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
      <label>
        Sucursal que entrega
        <select
          value={branch}
          disabled={bloqueado || cargando}
          onChange={(e) => {
            setCargando(true);
            setPagoVerificado(false);
            setBranch(Number(e.target.value));
            setItems([]);
          }}
        >
          <option value={0}>Selecciona una sucursal</option>
          {branches.map((b) => (
            <option value={b.id} key={b.id}>
              {b.nombre}
            </option>
          ))}
        </select>
      </label>
      {!branches.length && (
        <p>
          Configura las sucursales y concilia el inventario en Stock y lotes
          antes de operar.
        </p>
      )}
      <div className="pos-grid">
        <section className="pos-panel">
          <div className="pos-title">
            <div>
              <h2>Medicamentos</h2>
            </div>
            <span>{productos.length} productos</span>
          </div>
          <div className="pos-filters">
            <label>
              Código de barras
              <input
                ref={lector}
                autoFocus
                disabled={bloqueado || cargando}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") escanear();
                }}
                placeholder="Escanea y presiona Enter"
              />
            </label>
            <button disabled={bloqueado || cargando} onClick={escanear}>
              Agregar código
            </button>
            <label>
              Buscar producto
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Nombre, categoría o código"
              />
            </label>
          </div>
          <div className="pos-list">
            {cargando ? (
              <p>Cargando…</p>
            ) : filtrados.length ? (
              filtrados.map((p) => (
                <article className="pos-product" key={p.id}>
                  <div className="pos-icon">✚</div>
                  <div className="pos-product-name">
                    <small>
                      {p.categoria} · {p.codigoBarra ?? "Sin código"}
                    </small>
                    <h3>{p.nombre}</h3>
                    <span>
                      {[p.concentracion, p.formaFarmaceutica]
                        .filter(Boolean)
                        .join(" · ") || "Medicamento"}{" "}
                      ·{" "}
                      {(p.condicionVenta ?? "SIN_CLASIFICAR").replaceAll(
                        "_",
                        " ",
                      )}
                    </span>
                  </div>
                  <div className="pos-product-end">
                    <b>{p.precio === null ? "Sin precio" : pesos(p.precio)}</b>
                    <small>
                      {p.stock} disponibles
                      {p.stockMinimo > 0 && p.stock <= p.stockMinimo
                        ? " · Stock bajo"
                        : ""}
                    </small>
                    <button
                      disabled={
                        bloqueado ||
                        (items.find((item) => item.id === p.id)?.cantidad ??
                          0) >= p.stock ||
                        p.precio === null ||
                        p.precio <= 0 ||
                        p.condicionVenta !== "VENTA_DIRECTA"
                      }
                      onClick={() => agregar(p)}
                    >
                      Agregar +
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <p>No hay medicamentos que coincidan.</p>
            )}
          </div>
        </section>
        <aside className="pos-panel pos-checkout">
          <div className="pos-title">
            <div>
              <h2>Venta actual</h2>
            </div>
            <span>{items.reduce((n, i) => n + i.cantidad, 0)} unidades</span>
          </div>
          {!!items.length && (
            <button
              className="pos-limpiar"
              type="button"
              disabled={bloqueado}
              onClick={() => {
                if (!window.confirm("¿Vaciar la venta actual?")) return;
                setItems([]);
                setDescuento("");
                setRecibido("");
                setPagoVerificado(false);
                setTipoDocumento("BOLETA");
                setFacturacion(facturacionVacia);
                setMensaje("");
              }}
            >
              Vaciar venta
            </button>
          )}
          <div className="pos-cart">
            {items
              .filter(
                (item) =>
                  !productos.some((producto) => producto.id === item.id),
              )
              .map(({ id }) => (
                <div key={id} className="pos-line">
                  <span>Producto #{id} fuera del catálogo</span>
                  <button
                    type="button"
                    disabled={bloqueado}
                    onClick={() => cambiar(id, 0)}
                  >
                    Quitar
                  </button>
                </div>
              ))}
            {lineas.length ? (
              lineas.map((x) => (
                <div className="pos-line" key={x.id}>
                  <div>
                    <b>{x.producto.nombre}</b>
                    <small>{pesos(x.producto.precio ?? 0)} c/u</small>
                  </div>
                  <div className="pos-qty">
                    <button
                      disabled={bloqueado}
                      aria-label={`Quitar una unidad de ${x.producto.nombre}`}
                      onClick={() => cambiar(x.id, x.cantidad - 1)}
                    >
                      −
                    </button>
                    {x.cantidad}
                    <button
                      disabled={bloqueado || x.cantidad >= x.producto.stock}
                      aria-label={`Agregar una unidad de ${x.producto.nombre}`}
                      onClick={() => cambiar(x.id, x.cantidad + 1)}
                    >
                      +
                    </button>
                  </div>
                  <strong>
                    {pesos((x.producto.precio ?? 0) * x.cantidad)}
                  </strong>
                </div>
              ))
            ) : (
              <p className="pos-empty">
                Escanea un código o agrega un medicamento al carrito.
              </p>
            )}
          </div>
          <fieldset className="pos-controles" disabled={bloqueado}>
            <legend>Descuento, documento y pago</legend>
            <div className="pos-pay">
              <label>
                Tipo de operación
                <select
                  value={operation}
                  onChange={(event) =>
                    setOperation(
                      event.target.value === "DISPENSACION"
                        ? "DISPENSACION"
                        : "VENTA",
                    )
                  }
                >
                  <option value="VENTA">Venta</option>
                  <option value="DISPENSACION">Dispensación</option>
                </select>
              </label>
              <label>
                Descuento (CLP)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  max={subtotal}
                  value={descuento}
                  onChange={(e) => {
                    setDescuento(e.target.value);
                    setPagoVerificado(false);
                  }}
                  placeholder="0"
                  aria-invalid={!descuentoValido}
                />
              </label>
              <label>
                Documento
                <select
                  value={tipoDocumento}
                  onChange={(e) =>
                    setTipoDocumento(e.target.value as TipoDocumento)
                  }
                >
                  <option value="BOLETA">Boleta</option>
                  <option value="FACTURA">Factura</option>
                </select>
              </label>
            </div>
            {!descuentoValido && (
              <p role="alert">
                Ingresa un descuento válido que no supere el subtotal.
              </p>
            )}
            {tipoDocumento === "FACTURA" && (
              <fieldset className="pos-controles">
                <legend>Datos de facturación</legend>
                <div className="pos-pay">
                  {camposFacturacion.map(({ nombre, etiqueta, maximo }) => (
                    <label key={nombre}>
                      {etiqueta}
                      {nombre === "email" ? " (opcional)" : ""}
                      <input
                        type={nombre === "email" ? "email" : "text"}
                        maxLength={maximo}
                        value={facturacion[nombre]}
                        onChange={(e) =>
                          setFacturacion({
                            ...facturacion,
                            [nombre]: e.target.value,
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            <p className="pos-footnote">
              La emisión electrónica ante el SII está pendiente. Puedes imprimir
              una vista previa al confirmar.
            </p>
            <div className="pos-pay">
              <label>
                Medio de pago
                <select
                  value={pago}
                  onChange={(e) => {
                    setPago(e.target.value as MedioPago);
                    setPagoVerificado(false);
                  }}
                >
                  {Object.entries(mediosPago).map(([valor, nombre]) => (
                    <option key={valor} value={valor}>
                      {nombre}
                    </option>
                  ))}
                </select>
              </label>
              {pago === "EFECTIVO" && (
                <label>
                  Efectivo recibido
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={recibido}
                    onChange={(e) => setRecibido(e.target.value)}
                    placeholder="0"
                  />
                </label>
              )}
            </div>
            {pago !== "EFECTIVO" && (
              <label className="pos-validar-pago">
                <input
                  type="checkbox"
                  checked={pagoVerificado}
                  onChange={(e) => setPagoVerificado(e.target.checked)}
                />
                Confirmo que recibí el pago en el terminal o en la cuenta
                bancaria.
              </label>
            )}
          </fieldset>
          <div className="pos-importes">
            <div>
              <span>Subtotal con IVA</span>
              <strong>{pesos(subtotal)}</strong>
            </div>
            <div>
              <span>Descuento</span>
              <strong>−{pesos(descuentoValido ? importeDescuento : 0)}</strong>
            </div>
            <div>
              <span>Neto</span>
              <strong>{pesos(neto)}</strong>
            </div>
            <div>
              <span>IVA ({tasaIva} %)</span>
              <strong>{pesos(iva)}</strong>
            </div>
          </div>
          <div className="pos-total">
            <span>Total a pagar</span>
            <strong>{pesos(total)}</strong>
          </div>
          {pago === "EFECTIVO" && (
            <div className="pos-change">
              Vuelto: {pesos(Math.max(0, Number(recibido || 0) - total))}
            </div>
          )}
          <button
            className="pos-charge"
            disabled={
              bloqueado ||
              cargando ||
              !branch ||
              !lineas.length ||
              lineas.length !== items.length ||
              !descuentoValido
            }
            onClick={cobrar}
          >
            Preparar lotes · {pesos(total)}
          </button>
          <p className="pos-footnote">
            Se descuentan primero los lotes vigentes más próximos a vencer.
          </p>
        </aside>
      </div>
      <ClientesPendientes />
      <Modal
        open={preparing !== null}
        onOpenChange={(open) => {
          if (!open && !cobrando && !reintentar) setPreparing(null);
        }}
        title="Confirmar entrega física"
        description="Verifica el número de lote y la cantidad de cada envase antes de confirmar."
      >
        {preparing && (
          <FefoConfirmation
            sucursalId={branch}
            items={lineas.map(({ id, cantidad }) => ({
              medicamentoId: id,
              cantidad,
            }))}
            metodoPago={pago}
            recibido={pago === "EFECTIVO" ? Number(recibido) : undefined}
            tipoOperacion={operation}
            documento={preparing}
            descuento={importeDescuento}
            totalEsperado={total}
            onBusy={setCobrando}
            onRetry={setReintentar}
            onSuccess={(venta) => {
              setPreparing(null);
              setUltimaVenta(venta);
              setItems([]);
              setRecibido("");
              setDescuento("");
              setTipoDocumento("BOLETA");
              setFacturacion(facturacionVacia);
              void cargar();
            }}
          />
        )}
      </Modal>
    </section>
  );
}

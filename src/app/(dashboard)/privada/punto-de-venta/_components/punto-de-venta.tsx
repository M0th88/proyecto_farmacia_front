"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "@/components/ui/modal";
import type { Item, Producto } from "@/lib/types/punto-de-venta";
import { FefoConfirmation } from "./fefo-confirmation";

const pesos = (n: number) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(n);

export function PuntoDeVenta() {
  const [branch, setBranch] = useState(0);
  const [branches, setBranches] = useState<{ id: number; nombre: string }[]>(
    [],
  );
  const [preparing, setPreparing] = useState(false);
  const [operation, setOperation] = useState<"VENTA" | "DISPENSACION">("VENTA");
  const [productos, setProductos] = useState<Producto[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [codigo, setCodigo] = useState("");
  const [pago, setPago] = useState<
    "EFECTIVO" | "DEBITO" | "CREDITO" | "TRANSFERENCIA"
  >("EFECTIVO");
  const [recibido, setRecibido] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(true);
  const [cobrando, setCobrando] = useState(false);
  const lector = useRef<HTMLInputElement>(null);
  async function cargar() {
    setCargando(true);
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
    fetch(`/api/privada/catalogo?sucursalId=${branch}`, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error("No se pudo cargar el catálogo privado.");
        return (await r.json()) as Producto[];
      })
      .then(setProductos)
      .catch((e) =>
        setMensaje(e instanceof Error ? e.message : "Error de conexión."),
      )
      .finally(() => setCargando(false));
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
  const total = lineas.reduce(
    (n, x) => n + (x.producto.precio ?? 0) * x.cantidad,
    0,
  );
  function agregar(p: Producto) {
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
    const p = productos.find((x) => x.id === id);
    if (!p) return;
    if (n <= 0) setItems((v) => v.filter((x) => x.id !== id));
    else if (n <= p.stock)
      setItems((v) => v.map((x) => (x.id === id ? { ...x, cantidad: n } : x)));
    else setMensaje("La cantidad supera el stock disponible.");
  }
  function cobrar() {
    if (!branch || !items.length || cobrando) return;
    if (pago === "EFECTIVO" && (!recibido || Number(recibido) < total)) {
      setMensaje("El efectivo recibido no cubre el total.");
      return;
    }
    setPreparing(true);
  }
  return (
    <section className="pos-shell">
      <header className="pos-header">
        <div>
          <h1>POS</h1>
          <span>Escanea, prepara el pedido y registra el cobro.</span>
          <p>
            <Link href="/privada/historial-y-reportes#operaciones-recientes">
              Historial de ventas →
            </Link>
            {"　"}
            <Link href="/privada/stocks-y-lotes">Stock y vencimientos →</Link>
          </p>
        </div>
        <button onClick={() => void cargar()}>Actualizar catálogo</button>
      </header>

      {mensaje && (
        <div className="pos-message" role="status">
          {mensaje}
          <button onClick={() => setMensaje("")} aria-label="Cerrar">
            ×
          </button>
        </div>
      )}
      <label>
        Sucursal que entrega
        <select
          value={branch}
          disabled={cobrando}
          onChange={(e) => {
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
              <small>01 / SELECCIÓN</small>
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
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") escanear();
                }}
                placeholder="Escanea y presiona Enter"
              />
            </label>
            <button onClick={escanear}>Agregar código</button>
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
                        !p.stock ||
                        p.precio === null ||
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
              <small>02 / COBRO</small>
              <h2>Venta actual</h2>
            </div>
            <span>{items.reduce((n, i) => n + i.cantidad, 0)} unidades</span>
          </div>
          <div className="pos-cart">
            {lineas.length ? (
              lineas.map((x) => (
                <div className="pos-line" key={x.id}>
                  <div>
                    <b>{x.producto.nombre}</b>
                    <small>{pesos(x.producto.precio ?? 0)} c/u</small>
                  </div>
                  <div className="pos-qty">
                    <button onClick={() => cambiar(x.id, x.cantidad - 1)}>
                      −
                    </button>
                    {x.cantidad}
                    <button onClick={() => cambiar(x.id, x.cantidad + 1)}>
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
          <div className="pos-pay">
            <label>
              Tipo de operación
              <select
                value={operation}
                onChange={(e) =>
                  setOperation(e.target.value as typeof operation)
                }
              >
                <option value="VENTA">Venta</option>
                <option value="DISPENSACION">Dispensación</option>
              </select>
              Medio de pago
              <select
                value={pago}
                onChange={(e) => setPago(e.target.value as typeof pago)}
              >
                <option value="EFECTIVO">Efectivo</option>
                <option value="DEBITO">Tarjeta de débito</option>
                <option value="CREDITO">Tarjeta de crédito</option>
                <option value="TRANSFERENCIA">Transferencia</option>
              </select>
            </label>
            {pago === "EFECTIVO" && (
              <label>
                Efectivo recibido
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={recibido}
                  onChange={(e) => setRecibido(e.target.value)}
                  placeholder="0"
                />
              </label>
            )}
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
            disabled={!branch || !items.length || cobrando}
            onClick={() => void cobrar()}
          >
            {cobrando ? "Registrando…" : `Preparar lotes · ${pesos(total)}`}
          </button>
          <p className="pos-footnote">
            Se descuentan primero los lotes vigentes más próximos a vencer.
          </p>
        </aside>
      </div>
      <Modal
        open={preparing}
        onOpenChange={(open) => {
          if (!cobrando) setPreparing(open);
        }}
        title="Confirmar entrega física"
        description="Verifica el número de lote y la cantidad de cada envase antes de confirmar."
      >
        {preparing && (
          <FefoConfirmation
            sucursalId={branch}
            items={items.map((i) => ({
              medicamentoId: i.id,
              cantidad: i.cantidad,
            }))}
            metodoPago={pago}
            recibido={pago === "EFECTIVO" ? Number(recibido) : undefined}
            tipoOperacion={operation}
            onBusy={setCobrando}
            onSuccess={(id) => {
              setPreparing(false);
              setItems([]);
              setRecibido("");
              void cargar();
              setMensaje(`Operación #${id} registrada.`);
            }}
          />
        )}
      </Modal>
    </section>
  );
}

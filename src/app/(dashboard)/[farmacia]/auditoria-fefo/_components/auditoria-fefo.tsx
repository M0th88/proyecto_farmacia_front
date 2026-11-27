"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import styles from "@/components/admin-table.module.css";
import {
  type Action,
  type Field,
  InventarioActionDialog,
} from "@/components/inventario-action-dialog";
import { Button } from "@/components/ui/button";
import { stockDate, stockDaysRemaining } from "@/lib/private/stock-dates";
import { lotStates } from "@/lib/types/fefo";
import type { ControlData, ControlStock } from "@/lib/types/fefo-control";
import {
  stockOptionsQueryKey,
  stockQueryKey,
} from "../../stocks-y-lotes/actions";
import local from "./auditoria-fefo.module.css";
import { AuditoriaFefoLoading } from "./auditoria-fefo-loading";

const reason: Field = {
  key: "motivo",
  label: "Motivo / evidencia del procedimiento",
};
const localToIso = (value: string) => new Date(value).toISOString();
export function AuditoriaFefo() {
  const [branchId, setBranchId] = useState(0);
  const [search, setSearch] = useState("");
  const [view, setView] = useState("TODOS");
  const [trace, setTrace] = useState<number | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["fefo-control", trace],
    queryFn: async () => {
      const response = await fetch(
        `/api/privada/fefo${trace ? `?loteId=${trace}` : ""}`,
        { cache: "no-store" },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      return result as ControlData;
    },
  });
  const mutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const response = await fetch(action?.url ?? "/api/privada/fefo", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
    },
    onSuccess: async () => {
      await Promise.all(
        [
          ["fefo-control"],
          stockQueryKey,
          stockOptionsQueryKey,
          ["private-products"],
        ].map((queryKey) => client.invalidateQueries({ queryKey })),
      );
      setAction(null);
      toast.success("Operación registrada.");
    },
    onError: (error) => toast.error(error.message),
  });
  if (query.isPending) return <AuditoriaFefoLoading />;
  if (query.isError)
    return (
      <div role="alert">
        <p>{query.error.message}</p>
        <Button onClick={() => void query.refetch()}>Reintentar</Button>
      </div>
    );
  const data = query.data;
  const locationOptions = data.ubicaciones
    .filter((location) => location.sucursalId)
    .map((location) => ({
      value: location.id,
      label: `${location.nombre} · Sucursal #${location.sucursalId}`,
    }));
  const matching = data.stocks.filter(
    (stock) =>
      (!branchId || stock.ubicacion.sucursalId === branchId) &&
      `${stock.lote.numeroLote} ${stock.lote.medicamento.nombre} ${stock.ubicacion.nombre}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const expired = matching.filter(
    (stock) =>
      stock.cantidad > 0 && new Date(stock.lote.fechaVencimiento) <= new Date(),
  );
  const pending = matching.filter(
    (stock) =>
      stock.cantidad > 0 &&
      (stock.cantidadBloqueada > 0 ||
        stock.lote.estado !== "APTO" ||
        !stock.fechaRecepcion ||
        !stock.ubicacion.sucursalId),
  );
  const nearest = matching.filter((stock) => {
    const days = stockDaysRemaining(new Date(stock.lote.fechaVencimiento));
    return (
      stock.cantidad > 0 &&
      new Date(stock.lote.fechaVencimiento) > new Date() &&
      days >= 0 &&
      (stock.ubicacion.sucursal?.alertasDias ?? [7, 30]).some(
        (threshold) => days <= threshold,
      )
    );
  });
  const visible =
    view === "VENCIDOS"
      ? expired
      : view === "PROXIMOS"
        ? nearest
        : view === "PENDIENTES"
          ? pending
          : matching;
  const reconcile = (stock: ControlStock) =>
    setAction({
      title: "Conciliación física de existencia",
      body: {
        accion: "CONCILIAR",
        stockId: stock.id,
        numeroLote: stock.lote.numeroLote,
        rotulo: stockDate(new Date(stock.lote.fechaVencimiento)),
        fechaRecepcion: "",
        motivo: "",
        confirmado: false,
      },
      fields: [
        { key: "numeroLote", label: "Lote leído físicamente en el envase" },
        {
          key: "rotulo",
          label: "Vencimiento con día verificado",
          type: "date",
        },
        {
          key: "fechaRecepcion",
          label: "Recepción comprobada documentalmente",
          type: "datetime-local",
        },
        reason,
        {
          key: "confirmado",
          label: "Confirmo la verificación física y documental",
          type: "checkbox",
        },
      ],
    });
  return (
    <section className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Auditoría FEFO</h1>
          <p className={styles.note}>
            Recepciones, conciliación, retiros y trazabilidad. Los rótulos
            mes/año permanecen pendientes.
          </p>
        </div>
        <div className={styles.footer}>
          <Link href="/privada/stocks-y-lotes">Stocks y Lotes</Link>
          <Link href="/privada/sucursales">Sucursales</Link>
          <Link href="/privada/ubicaciones">Ubicaciones</Link>
        </div>
      </div>
      <div className="pos-metrics">
        <div>
          Pendientes / bloqueados<strong>{pending.length}</strong>
        </div>
        <div>
          Lotes vencidos para retiro<strong>{expired.length}</strong>
        </div>
        <div>
          Próximos según sucursal<strong>{nearest.length}</strong>
        </div>
        <div>
          Recepciones / devoluciones pendientes
          <strong>{data.revisiones.length}</strong>
        </div>
      </div>
      <section className={styles.card}>
        <h2>Existencias y lista de retiro físico</h2>
        <label className={styles.field}>
          Mostrar
          <select
            value={view}
            onChange={(event) => setView(event.target.value)}
          >
            <option value="TODOS">Todas las existencias</option>
            <option value="VENCIDOS">Retiro físico de vencidos</option>
            <option value="PROXIMOS">
              Próximos vencimientos según sucursal
            </option>
            <option value="PENDIENTES">Pendientes y bloqueados</option>
          </select>
        </label>
        <div className={styles.fields}>
          <label className={styles.field}>
            Sucursal
            <select
              value={branchId}
              onChange={(event) => setBranchId(Number(event.target.value))}
            >
              <option value={0}>Todas / pendientes de asignación</option>
              {data.sucursales.map((branch) => (
                <option value={branch.id} key={branch.id}>
                  {branch.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            Buscar lote o producto
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </div>
        <div className={local.tableScroll}>
          <table className={local.table}>
            <thead>
              <tr>
                <th>Producto / presentación</th>
                <th>Lote / vencimiento</th>
                <th>Ubicación</th>
                <th>Saldo</th>
                <th>Estado / recepción</th>
                <th>Operaciones</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((stock) => (
                <tr key={stock.id}>
                  <td>
                    {stock.lote.medicamento.nombre}
                    <small>
                      {stock.lote.medicamento.concentracion}{" "}
                      {stock.lote.medicamento.formaFarmaceutica}
                    </small>
                  </td>
                  <td>
                    {stock.lote.numeroLote}
                    <small>
                      {stock.lote.rotuloVencimiento ??
                        "Rótulo histórico sin verificar"}
                    </small>
                  </td>
                  <td>
                    {stock.ubicacion.nombre}
                    <small>
                      {stock.ubicacion.sucursal?.nombre ?? "Sin sucursal"}
                    </small>
                  </td>
                  <td>
                    {stock.cantidad}
                    {stock.cantidadBloqueada > 0 && (
                      <small> · {stock.cantidadBloqueada} en cuarentena</small>
                    )}
                  </td>
                  <td>
                    {stock.lote.estado}
                    <small
                      style={{
                        color: expired.includes(stock)
                          ? "#c3260c"
                          : nearest.includes(stock)
                            ? "#875e00"
                            : undefined,
                      }}
                    >
                      {expired.includes(stock)
                        ? "Vencido · retirar físicamente"
                        : nearest.includes(stock)
                          ? `Vence en ${stockDaysRemaining(new Date(stock.lote.fechaVencimiento))} días · alerta de sucursal`
                          : ""}
                    </small>
                    <small>
                      {stock.fechaRecepcion
                        ? new Date(stock.fechaRecepcion).toLocaleString(
                            "es-CL",
                            { timeZone: "America/Santiago" },
                          )
                        : "Recepción histórica sin verificar"}
                    </small>
                  </td>
                  <td>
                    <div className={local.buttons}>
                      <Button
                        variant="outline"
                        onClick={() => setTrace(stock.loteId)}
                      >
                        Ver salidas
                      </Button>
                      {data.permisos.liberar && (
                        <Button
                          variant="outline"
                          onClick={() => reconcile(stock)}
                        >
                          Conciliar
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        onClick={() =>
                          setAction({
                            title: "Bloquear lote en todas sus ubicaciones",
                            body: {
                              accion: "BLOQUEAR",
                              loteId: stock.loteId,
                              estado: "CUARENTENA",
                              motivo: "",
                            },
                            fields: [
                              {
                                key: "estado",
                                label: "Estado",
                                options: lotStates
                                  .filter((state) => state !== "APTO")
                                  .map((state) => ({
                                    value: state,
                                    label: state.replaceAll("_", " "),
                                  })),
                              },
                              reason,
                            ],
                          })
                        }
                      >
                        Bloquear
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() =>
                          setAction({
                            title: "Traspaso físico",
                            body: {
                              accion: "TRASPASAR",
                              stockId: stock.id,
                              destinoId: 0,
                              cantidad: 1,
                              motivo: "",
                            },
                            fields: [
                              {
                                key: "destinoId",
                                label: "Destino",
                                type: "number",
                                options: locationOptions.filter(
                                  (location) =>
                                    location.value !== stock.ubicacionId,
                                ),
                              },
                              {
                                key: "cantidad",
                                label: "Cantidad",
                                type: "number",
                              },
                              reason,
                            ],
                          })
                        }
                      >
                        Traspasar
                      </Button>
                      {new Date(stock.lote.fechaVencimiento) <= new Date() &&
                        stock.cantidadBloqueada > 0 && (
                          <Link href="/privada/productos-vencidos">
                            Gestionar retiro
                          </Link>
                        )}
                      {new Date(stock.lote.fechaVencimiento) <= new Date() &&
                        !stock.cantidadBloqueada && (
                          <Button
                            variant="danger"
                            onClick={() =>
                              setAction({
                                title: "Confirmar retiro físico de vencidos",
                                body: {
                                  accion: "RETIRAR",
                                  stockId: stock.id,
                                  cantidadAnterior: stock.cantidad,
                                  confirmado: false,
                                  motivo: "",
                                },
                                fields: [
                                  reason,
                                  {
                                    key: "confirmado",
                                    label: `Confirmo que retiré físicamente ${stock.cantidad} unidades`,
                                    type: "checkbox",
                                  },
                                ],
                              })
                            }
                          >
                            Retiro físico
                          </Button>
                        )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!visible.length && <p>No hay existencias para este filtro.</p>}
      </section>
      <section className={styles.card}>
        <h2>Recepciones y devoluciones pendientes de revisión</h2>
        <div className={local.rows}>
          {data.revisiones.map((review) => (
            <div key={review.id}>
              <span>
                <b>
                  Revisión #{review.id} · {review.origen}
                </b>
                <small>
                  Producto #{review.medicamentoId} · {review.cantidad} unidades
                  · Lote {review.numeroLote || "No verificable"} · Rótulo{" "}
                  {review.rotuloVencimiento || "No verificable"}
                </small>
                {review.precisionVencimiento === "MES_ANIO" && (
                  <small>
                    Mes/año: pendiente de criterio del director técnico. No se
                    puede aprobar.
                  </small>
                )}
              </span>
              {data.permisos.liberar && (
                <div className={local.buttons}>
                  <Button
                    variant="outline"
                    disabled={review.precisionVencimiento === "MES_ANIO"}
                    onClick={() =>
                      setAction({
                        title: "Resolver revisión física",
                        body: {
                          accion: "APROBAR",
                          revisionId: review.id,
                          numeroLote: review.numeroLote ?? "",
                          rotulo: "",
                          motivo: "",
                        },
                        fields: [
                          { key: "numeroLote", label: "Lote verificado" },
                          {
                            key: "rotulo",
                            label: "Vencimiento completo verificado",
                            type: "date",
                          },
                          reason,
                        ],
                      })
                    }
                  >
                    Aprobar
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      setAction({
                        title: "Rechazar reincorporación",
                        body: {
                          accion: "RECHAZAR",
                          revisionId: review.id,
                          motivo: "",
                        },
                        fields: [reason],
                      })
                    }
                  >
                    Rechazar
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
        {!data.revisiones.length && <p>No hay recepciones pendientes.</p>}
      </section>
      <section className={styles.card}>
        <h2>Anulaciones y devoluciones</h2>
        <p className={styles.note}>
          Anular una venta no devuelve stock. La devolución física se registra
          por detalle de venta y queda pendiente de revisión.
        </p>
        <div className={local.buttons}>
          {data.permisos.anular && (
            <Button
              variant="outline"
              onClick={() =>
                setAction({
                  title: "Anular venta sin reincorporar stock",
                  url: "/api/privada/ventas",
                  body: { id: 0, motivo: "" },
                  fields: [
                    { key: "id", label: "ID de venta", type: "number" },
                    reason,
                  ],
                })
              }
            >
              Anular venta
            </Button>
          )}
          {data.permisos.devolver && (
            <Button
              variant="outline"
              onClick={() =>
                setAction({
                  title: "Registrar devolución física pendiente",
                  body: {
                    accion: "DEVOLVER",
                    detalleVentaId: 0,
                    ubicacionId: 0,
                    cantidad: 1,
                    motivo: "",
                  },
                  fields: [
                    {
                      key: "detalleVentaId",
                      label: "ID del detalle en Historial",
                      type: "number",
                    },
                    {
                      key: "ubicacionId",
                      label: "Ubicación receptora",
                      type: "number",
                      options: locationOptions,
                    },
                    {
                      key: "cantidad",
                      label: "Unidades recibidas físicamente",
                      type: "number",
                    },
                    reason,
                  ],
                })
              }
            >
              Recibir devolución
            </Button>
          )}
        </div>
      </section>
      {trace && (
        <section className={styles.card}>
          <h2>Movimientos del lote #{trace}</h2>
          <div className={local.tableScroll}>
            <table className={local.table}>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Cantidad</th>
                  <th>Usuario / ubicación / venta</th>
                  <th>Registro</th>
                </tr>
              </thead>
              <tbody>
                {data.movimientos.map((movement) => (
                  <tr key={movement.id}>
                    <td>
                      {new Date(movement.creadoEn).toLocaleString("es-CL", {
                        timeZone: "America/Santiago",
                      })}
                    </td>
                    <td>{movement.tipo}</td>
                    <td>{movement.cantidad}</td>
                    <td>
                      Usuario #{movement.usuarioId ?? "histórico"} · Ubicación #
                      {movement.ubicacionId ?? "sin dato"} · Venta #
                      {movement.ventaId ?? "—"}
                    </td>
                    <td>
                      {movement.origen}
                      <small>{movement.motivo}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {action && (
        <InventarioActionDialog
          key={action.title}
          action={action}
          onChange={setAction}
          pending={mutation.isPending}
          error={mutation.error?.message}
          description="Verifica los datos antes de confirmar."
          onSubmit={(values) => {
            const body = { ...values };
            if (typeof body.fechaRecepcion === "string" && body.fechaRecepcion)
              body.fechaRecepcion = localToIso(body.fechaRecepcion);
            mutation.mutate(body);
          }}
        />
      )}
    </section>
  );
}

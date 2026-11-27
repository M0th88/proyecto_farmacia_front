"use client";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import formStyles from "@/components/admin-table.module.css";
import { Button } from "@/components/ui/button";
import type { FefoPlan } from "@/lib/types/fefo";
import type { VentaConfirmada } from "@/lib/types/punto-de-venta";
import {
  calcularTotales,
  type DocumentoVenta,
  pesos,
} from "@/lib/validation/punto-de-venta";
import type { RecetaInput } from "@/lib/validation/recetas";
import styles from "./fefo-confirmation.module.css";

type Props = {
  sucursalId: number;
  items: { medicamentoId: number; cantidad: number }[];
  metodoPago: string;
  recibido?: number;
  tipoOperacion: string;
  documento: DocumentoVenta;
  receta?: RecetaInput;
  descuento: number;
  totalEsperado: number;
  onBusy: (busy: boolean) => void;
  onRetry: (pending: boolean) => void;
  onSuccess: (venta: VentaConfirmada) => void;
};
export function FefoConfirmation(props: Props) {
  const [key] = useState(() => crypto.randomUUID());
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(false);
  const requestBody = useRef<string | null>(null);
  const inFlight = useRef(false);
  const [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const [custom, setCustom] = useState<Record<number, number> | null>(null);
  const query = useQuery<FefoPlan>({
    queryKey: ["fefo-preparacion", props.sucursalId, props.items],
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async () => {
      const response = await fetch("/api/privada/ventas/preparar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sucursalId: props.sucursalId,
          items: props.items,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      return data;
    },
  });
  const plan = !query.isFetching && !query.isError ? query.data : undefined;
  const totalValidado = plan
    ? calcularTotales(plan.total, props.descuento).total
    : null;
  const precioCambio =
    totalValidado !== null && totalValidado !== props.totalEsperado;
  const locked = busy || retry;

  async function submit() {
    if (inFlight.current) return;
    if (!requestBody.current) {
      if (!plan || !confirmed || plan.faltantes.length || precioCambio) return;
      const chosen = custom
        ? plan.aptos
            .map((l) => ({ ...l, cantidad: custom[l.stockId] ?? 0 }))
            .filter((l) => l.cantidad > 0)
        : plan.sugeridos;
      requestBody.current = JSON.stringify({
        sucursalId: props.sucursalId,
        items: props.items,
        metodoPago: props.metodoPago,
        recibido: props.recibido,
        tipoOperacion: props.tipoOperacion,
        claveOperacion: key,
        totalEsperado: props.totalEsperado,
        descuento: props.descuento,
        documento: props.documento,
        receta: props.receta,
        confirmacionFisica: true,
        motivoExcepcion: reason,
        lotes: chosen.map((l) => ({
          stockId: l.stockId,
          medicamentoId: l.medicamentoId,
          cantidad: l.cantidad,
        })),
      });
    }
    inFlight.current = true;
    setBusy(true);
    props.onBusy(true);
    setError("");
    try {
      const response = await fetch("/api/privada/ventas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: requestBody.current,
        signal: AbortSignal.timeout(15000),
      });
      const data = await response.json();
      if (!response.ok) {
        if (
          [400, 409].includes(response.status) ||
          (!retry && [401, 403].includes(response.status))
        ) {
          requestBody.current = null;
        }
        throw new Error(data.error ?? "No se pudo confirmar el cobro.");
      }
      requestBody.current = null;
      setRetry(false);
      props.onRetry(false);
      props.onSuccess(data);
    } catch (e) {
      const pending = requestBody.current !== null;
      setRetry(pending);
      props.onRetry(pending);
      setError(
        pending
          ? "El registro del cobro está sin confirmar. Reintenta el mismo cobro."
          : e instanceof Error
            ? e.message
            : "No se pudo confirmar el cobro.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
      props.onBusy(false);
    }
  }
  return (
    <div style={{ display: "grid", gap: 16 }}>
      {query.isPending && <p>Preparando lotes aptos…</p>}
      {query.isError && <p role="alert">{query.error.message}</p>}
      {plan && (
        <>
          {plan.faltantes.map((row) => (
            <p
              role="alert"
              key={row.medicamentoId}
              style={{ color: "#c62828" }}
            >
              Producto #{row.medicamentoId}: faltan {row.cantidad} unidades
              aptas. No se puede confirmar.
            </p>
          ))}
          <div style={{ overflowX: "auto", maxHeight: 330 }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Producto / presentación</th>
                  <th>Lote</th>
                  <th>Vencimiento (envase)</th>
                  <th>Ubicación</th>
                  <th>Cantidad</th>
                </tr>
              </thead>
              <tbody>
                {(custom ? plan.aptos : plan.sugeridos).map((lot) => (
                  <tr key={lot.stockId}>
                    <td>{lot.producto}</td>
                    <td>{lot.numeroLote}</td>
                    <td>{lot.rotulo}</td>
                    <td>{lot.ubicacion}</td>
                    <td>
                      {custom ? (
                        <input
                          aria-label={`Cantidad del lote ${lot.numeroLote}`}
                          type="number"
                          min={0}
                          max={lot.disponible}
                          step={1}
                          disabled={locked}
                          value={custom[lot.stockId] ?? 0}
                          onChange={(e) => {
                            setConfirmed(false);
                            setCustom({
                              ...custom,
                              [lot.stockId]: Number(e.target.value),
                            });
                          }}
                        />
                      ) : (
                        lot.cantidad
                      )}{" "}
                      / {lot.disponible}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {plan.permiteExcepcion && (
            <>
              <label className={formStyles.inline}>
                <input
                  type="checkbox"
                  checked={!!custom}
                  disabled={locked}
                  onChange={(e) => {
                    setConfirmed(false);
                    setCustom(
                      e.target.checked
                        ? Object.fromEntries(
                            plan.sugeridos.map((l) => [l.stockId, l.cantidad]),
                          )
                        : null,
                    );
                  }}
                />{" "}
                Aplicar excepción autorizada al orden FEFO
              </label>
              {custom && (
                <label className={formStyles.field}>
                  Motivo de la excepción
                  <textarea
                    maxLength={500}
                    disabled={locked}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
              )}
            </>
          )}
          <label className={formStyles.inline}>
            <input
              type="checkbox"
              checked={confirmed}
              disabled={locked}
              onChange={(e) => setConfirmed(e.target.checked)}
            />{" "}
            Confirmo que los lotes físicos entregados y sus cantidades coinciden
            con esta lista.
          </label>
          <p>
            Total con descuento: {pesos(totalValidado ?? props.totalEsperado)}
          </p>
          {precioCambio && (
            <p role="alert">
              El total cambió. Actualiza el catálogo antes de cobrar.
            </p>
          )}
          {!retry && (
            <Button
              disabled={
                busy ||
                !confirmed ||
                precioCambio ||
                !!plan.faltantes.length ||
                (!!custom && !reason.trim())
              }
              onClick={() => void submit()}
            >
              {busy ? "Confirmando…" : "Confirmar entrega y registrar"}
            </Button>
          )}
        </>
      )}
      {error && (
        <p role="alert" style={{ color: "#c62828" }}>
          {error}
        </p>
      )}
      {retry && (
        <Button disabled={busy} onClick={() => void submit()}>
          {busy ? "Confirmando…" : "Reintentar el mismo cobro"}
        </Button>
      )}
      <Button
        variant="outline"
        disabled={locked}
        onClick={() => {
          setConfirmed(false);
          setCustom(null);
          void query.refetch();
        }}
      >
        Actualizar preparación
      </Button>
    </div>
  );
}

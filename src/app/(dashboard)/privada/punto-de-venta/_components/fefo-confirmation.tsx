"use client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import formStyles from "@/components/admin-table.module.css";
import { Button } from "@/components/ui/button";
import type { FefoPlan } from "@/lib/types/fefo";
import styles from "./fefo-confirmation.module.css";

type Props = {
  sucursalId: number;
  items: { medicamentoId: number; cantidad: number }[];
  metodoPago: string;
  recibido?: number;
  tipoOperacion: string;
  onBusy: (busy: boolean) => void;
  onSuccess: (id: number) => void;
};
export function FefoConfirmation(props: Props) {
  const [key] = useState(() => crypto.randomUUID());
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
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
  async function submit() {
    if (!plan || busy || !confirmed || plan.faltantes.length) return;
    setBusy(true);
    props.onBusy(true);
    setError("");
    try {
      const chosen = custom
        ? plan.aptos
            .map((l) => ({ ...l, cantidad: custom[l.stockId] ?? 0 }))
            .filter((l) => l.cantidad > 0)
        : plan.sugeridos;
      const response = await fetch("/api/privada/ventas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sucursalId: props.sucursalId,
          items: props.items,
          metodoPago: props.metodoPago,
          recibido: props.recibido,
          tipoOperacion: props.tipoOperacion,
          claveOperacion: key,
          totalEsperado: plan.total,
          confirmacionFisica: true,
          motivoExcepcion: reason,
          lotes: chosen.map((l) => ({
            stockId: l.stockId,
            medicamentoId: l.medicamentoId,
            cantidad: l.cantidad,
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      props.onSuccess(data.id);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "No se pudo confirmar. Puedes reintentar la misma operación.",
      );
    } finally {
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
                  disabled={busy}
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
              disabled={busy}
              onChange={(e) => setConfirmed(e.target.checked)}
            />{" "}
            Confirmo que los lotes físicos entregados y sus cantidades coinciden
            con esta lista.
          </label>
          <p>
            Total validado:{" "}
            {new Intl.NumberFormat("es-CL", {
              style: "currency",
              currency: "CLP",
            }).format(plan.total)}
          </p>
          <Button
            disabled={
              busy ||
              !confirmed ||
              !!plan.faltantes.length ||
              (!!custom && !reason.trim())
            }
            onClick={() => void submit()}
          >
            {busy ? "Confirmando…" : "Confirmar entrega y registrar"}
          </Button>
        </>
      )}
      {error && (
        <p role="alert" style={{ color: "#c62828" }}>
          {error}
        </p>
      )}
      <Button
        variant="outline"
        disabled={busy}
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

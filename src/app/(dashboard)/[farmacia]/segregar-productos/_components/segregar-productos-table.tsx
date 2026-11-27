"use client";

import * as Menu from "@radix-ui/react-dropdown-menu";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
  MoreHorizontal,
  PackageMinus,
  Printer,
  ShieldAlert,
} from "lucide-react";
import { useState } from "react";
import { flushSync } from "react-dom";
import styles from "@/components/admin-table.module.css";
import { DataTable } from "@/components/data-table";
import { EtiquetaExistencia } from "@/components/etiqueta-existencia";
import etiquetaStyles from "@/components/etiqueta-inventario.module.css";
import { usePharmacy } from "@/components/pharmacy-provider";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { etiquetaVencimiento } from "@/lib/etiqueta-vencimiento";
import type { ExistenciaCuarentena } from "@/lib/types/cuarentena";
import type { PaginationResponse } from "@/lib/types/pagination";
import {
  FiltroVencimiento,
  type FiltroVencimientoValor,
} from "./filtro-vencimiento";
import { columnasSegregar as nombres } from "./table-config";

type Accion = "REGISTRAR" | "RETIRAR_VENCIDO";

export function SegregarProductosTable() {
  const farmacia = usePharmacy();
  const ruta = `/api/${farmacia}/cuarentena`;
  const cache = useQueryClient();
  const [alerta, setAlerta] = useState<FiltroVencimientoValor>("todos");
  const [seleccion, setSeleccion] = useState<{
    stock: ExistenciaCuarentena;
    accion: Accion;
  } | null>(null);
  const [impresion, setImpresion] = useState<ExistenciaCuarentena | null>(null);
  const cambio = useMutation({
    mutationFn: async (datos: {
      accion: Accion;
      stockId: number;
      cantidad: number;
      motivo: string;
      tipo: string;
    }) => {
      const respuesta = await fetch(ruta, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datos),
      });
      if (!respuesta.ok) {
        const error = await respuesta.json().catch(() => null);
        throw new Error(error?.error ?? "No se pudo guardar el cambio.");
      }
    },
    onSuccess: async () => {
      setSeleccion(null);
      await cache.invalidateQueries();
    },
  });

  const columnas: ColumnDef<ExistenciaCuarentena>[] = [
    { accessorKey: "producto", header: nombres.producto, size: 225 },
    { accessorKey: "lote", header: nombres.lote, size: 120 },
    { accessorKey: "ubicacion", header: nombres.ubicacion, size: 150 },
    {
      accessorKey: "vencimiento",
      header: nombres.vencimiento,
      size: 205,
      cell: ({ row: { original: stock } }) => {
        const { color, texto } = etiquetaVencimiento(
          alerta === "gris" ? null : stock.vencimiento,
        );
        return (
          <div>
            <span
              className={`${styles.badge} ${etiquetaStyles.estado}`}
              data-color={color}
            >
              {texto}
            </span>
            <div>
              {stock.rotulo ||
                stock.vencimiento?.split("-").reverse().join("/")}
            </div>
            {stock.vencimientoPorVerificar && (
              <small>Fecha por verificar</small>
            )}
          </div>
        );
      },
    },
    { accessorKey: "cantidad", header: nombres.cantidad, size: 113 },
    {
      accessorKey: "cantidadBloqueada",
      header: nombres.cantidadBloqueada,
      size: 137,
    },
    {
      id: "acciones",
      header: nombres.acciones,
      size: 85,
      enableSorting: false,
      cell: ({ row: { original: stock } }) => {
        const vencido = etiquetaVencimiento(stock.vencimiento).color === "rojo";
        return (
          <Menu.Root>
            <Menu.Trigger asChild>
              <Button
                variant="ghost"
                aria-label={`Acciones de ${stock.producto}, lote ${stock.lote}`}
              >
                <MoreHorizontal size={18} />
              </Button>
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Content className={styles.menu} align="end" sideOffset={8}>
                <Menu.Item
                  className={styles.menuItem}
                  onSelect={() => {
                    flushSync(() => setImpresion(stock));
                    window.print();
                    setImpresion(null);
                  }}
                >
                  <Printer size={16} /> Imprimir etiqueta
                </Menu.Item>
                {stock.cantidad > stock.cantidadBloqueada &&
                  !(vencido && stock.vencimientoPorVerificar) && (
                    <Menu.Item
                      className={styles.menuItem}
                      onSelect={() => {
                        cambio.reset();
                        setSeleccion({
                          stock,
                          accion: vencido ? "RETIRAR_VENCIDO" : "REGISTRAR",
                        });
                      }}
                    >
                      {vencido ? (
                        <>
                          <PackageMinus size={16} /> Registrar retiro físico
                        </>
                      ) : (
                        <>
                          <ShieldAlert size={16} /> Poner en cuarentena
                        </>
                      )}
                    </Menu.Item>
                  )}
              </Menu.Content>
            </Menu.Portal>
          </Menu.Root>
        );
      },
    },
  ];
  const retiro = seleccion?.accion === "RETIRAR_VENCIDO";
  const saldo = seleccion
    ? seleccion.stock.cantidad - seleccion.stock.cantidadBloqueada
    : 0;

  return (
    <section className={styles.page}>
      <h1 className={styles.title}>Segregar Productos</h1>
      <DataTable
        columns={columnas}
        entityLabel="existencias"
        queryKey={["cuarentena", farmacia, "SEGREGAR", alerta]}
        queryFn={async ({ pageParam, search, sorting, signal }) => {
          const params = new URLSearchParams({
            vista: "SEGREGAR",
            pagina: String(pageParam),
            buscar: alerta === "todos" ? search.trim() : "",
            alerta,
          });
          const orden = sorting[0];
          if (orden) {
            params.set("ordenar", orden.id);
            params.set("direccion", orden.desc ? "desc" : "asc");
          }
          const respuesta = await fetch(`${ruta}?${params}`, { signal });
          if (!respuesta.ok)
            throw new Error("No se pudo cargar el inventario.");
          return (await respuesta.json()) as PaginationResponse<ExistenciaCuarentena>;
        }}
        placeholder="Filtrar por producto, lote o ubicación"
        emptyTitle="No hay existencias para los filtros seleccionados."
        getRowId={(stock) => String(stock.id)}
        showRefresh={false}
        renderSearch={({ id, value, onChange, placeholder }) => (
          <FiltroVencimiento
            id={id}
            valor={alerta}
            texto={value}
            placeholder={placeholder}
            onChange={(estado, texto) => {
              onChange(texto);
              setAlerta(estado);
            }}
          />
        )}
      />
      {seleccion && (
        <Modal
          open
          onOpenChange={(open) => {
            if (!open && !cambio.isPending) setSeleccion(null);
          }}
          title={retiro ? "Registrar retiro físico" : "Poner en cuarentena"}
          description={`${seleccion.stock.producto} · Lote ${seleccion.stock.lote} · ${seleccion.stock.ubicacion}`}
        >
          <form
            className={styles.form}
            onSubmit={(event) => {
              event.preventDefault();
              const datos = new FormData(event.currentTarget);
              cambio.mutate({
                accion: seleccion.accion,
                stockId: seleccion.stock.id,
                cantidad: Number(datos.get("cantidad")),
                motivo: String(datos.get("motivo")),
                tipo: String(datos.get("tipo") ?? ""),
              });
            }}
          >
            {!retiro && (
              <label className={styles.field}>
                Tipo de cuarentena
                <select name="tipo">
                  <option value="TRANSITORIA">Transitoria</option>
                  <option value="SANITARIA">Sanitaria</option>
                </select>
              </label>
            )}
            <label className={styles.field}>
              {retiro ? "Unidades retiradas" : "Cantidad"}
              <input
                name="cantidad"
                type="number"
                min={1}
                max={saldo}
                defaultValue={retiro ? saldo : 1}
                required
              />
            </label>
            <label className={styles.field}>
              Motivo{" "}
              <textarea name="motivo" minLength={3} maxLength={500} required />
            </label>
            {cambio.error && (
              <p role="alert" className={styles.error}>
                {cambio.error.message}
              </p>
            )}
            <div className={styles.footer}>
              <Button
                type="button"
                variant="outline"
                disabled={cambio.isPending}
                onClick={() => setSeleccion(null)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={cambio.isPending}>
                {retiro ? "Confirmar retiro" : "Bloquear unidades"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {impresion && (
        <EtiquetaExistencia
          stock={impresion}
          estado={etiquetaVencimiento(
            alerta === "gris" ? null : impresion.vencimiento,
          )}
        />
      )}
    </section>
  );
}

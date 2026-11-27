"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import type { Branch } from "@/lib/types/fefo-control";
import styles from "./admin-table.module.css";
import { TableSkeleton } from "./data-table";
import {
  type Action,
  InventarioActionDialog,
} from "./inventario-action-dialog";
import { Button } from "./ui/button";

type Ubicacion = {
  id: number;
  nombre: string;
  tipo: string;
  sucursalId: number | null;
};

type Configuracion = {
  sucursales: Branch[];
  ubicaciones: Ubicacion[];
  puedeConfigurar: boolean;
};

export type VistaAlmacen = "Sucursales" | "Ubicaciones";

const encabezados = {
  Sucursales: [
    "Sucursal",
    "Alertas",
    "Excepciones FEFO",
    "Reingreso",
    "Acciones",
  ],
  Ubicaciones: ["Ubicación", "Tipo", "Sucursal", "Acciones"],
};

export function ConfiguracionAlmacenLoading({
  vista,
}: {
  vista: VistaAlmacen;
}) {
  return (
    <section className={styles.page}>
      <h1 className={styles.title}>{vista}</h1>
      <TableSkeleton headers={encabezados[vista]} />
    </section>
  );
}

function sucursalAction(sucursal?: Branch): Action {
  return {
    title: sucursal ? "Configurar sucursal" : "Nueva sucursal",
    body: {
      accion: "SUCURSAL",
      ...(sucursal && { id: sucursal.id }),
      nombre: sucursal?.nombre ?? "",
      alertasDias: sucursal?.alertasDias.join(", ") ?? "7, 30",
      permiteExcepcion: sucursal?.permiteExcepcion ?? false,
      permiteReingreso: sucursal?.permiteReingreso ?? false,
      procedimiento: sucursal?.procedimiento ?? "",
    },
    fields: [
      { key: "nombre", label: "Nombre real de la sucursal" },
      {
        key: "alertasDias",
        label: "Umbrales de alerta en días, separados por comas",
      },
      {
        key: "procedimiento",
        label: "Referencia de procedimiento validado por director técnico",
        optional: true,
      },
      {
        key: "permiteExcepcion",
        label: "El procedimiento permite excepciones FEFO",
        type: "checkbox",
      },
      {
        key: "permiteReingreso",
        label: "El procedimiento permite reincorporar devoluciones revisadas",
        type: "checkbox",
      },
    ],
  };
}

function ubicacionAction(sucursales: Branch[], ubicacion?: Ubicacion): Action {
  return {
    title: ubicacion
      ? `Asignar sucursal a ${ubicacion.nombre}`
      : "Nueva ubicación",
    body: {
      ...(ubicacion
        ? { accion: "UBICACION", ubicacionId: ubicacion.id }
        : { accion: "CREAR_UBICACION", nombre: "", tipo: "BODEGA" }),
      sucursalId: "",
    },
    fields: [
      ...(!ubicacion
        ? [
            { key: "nombre", label: "Nombre" },
            {
              key: "tipo",
              label: "Tipo",
              options: [
                { value: "BODEGA", label: "Bodega" },
                { value: "VITRINA", label: "Vitrina" },
              ],
            },
          ]
        : []),
      {
        key: "sucursalId",
        label: "Sucursal",
        type: "number",
        options: sucursales.map(({ id, nombre }) => ({
          value: id,
          label: nombre,
        })),
      },
    ],
  };
}

const destino = "/api/privada/fefo";

export function ConfiguracionAlmacen({ vista }: { vista: VistaAlmacen }) {
  const client = useQueryClient();
  const [action, setAction] = useState<Action | null>(null);
  const query = useQuery<Configuracion>({
    queryKey: ["fefo-configuracion"],
    queryFn: async ({ signal }) => {
      const respuesta = await fetch(`${destino}?configuracion=1`, {
        signal,
        cache: "no-store",
      });
      if (!respuesta.ok)
        throw new Error("No se pudo cargar la configuración de Almacén.");
      return respuesta.json();
    },
  });
  const cambio = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const body = { ...values };
      if (typeof body.alertasDias === "string")
        body.alertasDias = body.alertasDias
          .split(",")
          .map((valor) => (valor.trim() === "" ? null : Number(valor)));
      const respuesta = await fetch(destino, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!respuesta.ok) {
        const error = await respuesta.json().catch(() => null);
        throw new Error(error?.error ?? "No se pudo guardar el cambio.");
      }
    },
    onSuccess: async () => {
      await client.invalidateQueries();
      setAction(null);
      toast.success("Configuración guardada.");
    },
  });

  if (query.isPending) return <ConfiguracionAlmacenLoading vista={vista} />;
  if (query.isError)
    return (
      <section className={styles.page}>
        <h1 className={styles.title}>{vista}</h1>
        <p role="alert">{query.error.message}</p>
        <Button onClick={() => void query.refetch()}>Reintentar</Button>
      </section>
    );

  const { sucursales, ubicaciones, puedeConfigurar } = query.data;
  const esSucursal = vista === "Sucursales";
  const sucursalesPorId = new Map(
    sucursales.map((item) => [item.id, item.nombre]),
  );
  function abrir(nuevaAccion: Action) {
    cambio.reset();
    setAction(nuevaAccion);
  }

  return (
    <section className={styles.page}>
      <header className={styles.pageHeader}>
        <h1 className={styles.title}>{vista}</h1>
        <div className={styles.footer}>
          <Link
            href={esSucursal ? "/privada/ubicaciones" : "/privada/sucursales"}
          >
            {esSucursal ? "Ver ubicaciones" : "Ver sucursales"}
          </Link>
          {puedeConfigurar && (
            <Button
              disabled={!esSucursal && !sucursales.length}
              onClick={() =>
                abrir(
                  esSucursal ? sucursalAction() : ubicacionAction(sucursales),
                )
              }
            >
              {esSucursal ? "Nueva sucursal" : "Nueva ubicación"}
            </Button>
          )}
        </div>
      </header>
      {!esSucursal && !sucursales.length && (
        <p>Crea una sucursal para poder crear o asignar ubicaciones.</p>
      )}
      <div className={styles.card}>
        {(esSucursal ? sucursales.length : ubicaciones.length) ? (
          <div className={styles.configurationTable}>
            <table>
              <thead>
                <tr>
                  {encabezados[vista].map((columna) => (
                    <th key={columna} scope="col">
                      {columna}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {esSucursal
                  ? sucursales.map((sucursal) => (
                      <tr key={sucursal.id}>
                        <td>
                          <strong>{sucursal.nombre}</strong>
                        </td>
                        <td>{sucursal.alertasDias.join(", ")} días</td>
                        <td>
                          {sucursal.permiteExcepcion
                            ? "Con permiso y motivo"
                            : "Deshabilitadas"}
                        </td>
                        <td>
                          {sucursal.permiteReingreso
                            ? "Tras revisión"
                            : "Deshabilitado"}
                        </td>
                        <td>
                          {puedeConfigurar && (
                            <Button
                              variant="outline"
                              onClick={() => abrir(sucursalAction(sucursal))}
                            >
                              Configurar
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))
                  : ubicaciones.map((ubicacion) => (
                      <tr key={ubicacion.id}>
                        <td>
                          <strong>{ubicacion.nombre}</strong>
                        </td>
                        <td>
                          {ubicacion.tipo === "BODEGA"
                            ? "Bodega"
                            : ubicacion.tipo === "VITRINA"
                              ? "Vitrina"
                              : ubicacion.tipo}
                        </td>
                        <td>
                          {ubicacion.sucursalId
                            ? sucursalesPorId.get(ubicacion.sucursalId)
                            : "Sin sucursal asignada"}
                        </td>
                        <td>
                          {puedeConfigurar && !ubicacion.sucursalId && (
                            <Button
                              variant="outline"
                              disabled={!sucursales.length}
                              onClick={() =>
                                abrir(ubicacionAction(sucursales, ubicacion))
                              }
                            >
                              Asignar
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>
            {esSucursal
              ? "No hay sucursales registradas."
              : "No hay ubicaciones registradas."}
          </p>
        )}
      </div>
      {action && (
        <InventarioActionDialog
          action={action}
          onChange={setAction}
          onSubmit={(body) => cambio.mutate(body)}
          pending={cambio.isPending}
          error={cambio.error?.message}
          description={
            esSucursal
              ? "Configura las alertas y los permisos de operación de esta sucursal."
              : "Selecciona la sucursal a la que pertenece físicamente la ubicación."
          }
        />
      )}
    </section>
  );
}

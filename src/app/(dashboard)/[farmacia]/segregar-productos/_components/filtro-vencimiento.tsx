"use client";

import { ChevronDown } from "lucide-react";
import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import styles from "./filtro-vencimiento.module.css";

const opciones = [
  { valor: "todos", etiqueta: "Todos" },
  { valor: "rojo", etiqueta: "Vencidos" },
  { valor: "amarillo", etiqueta: "Próximos a vencer (30 días)" },
  { valor: "verde", etiqueta: "Vigentes (más de 30 días)" },
  { valor: "gris", etiqueta: "Sin fecha confirmada" },
] as const;

export type FiltroVencimientoValor = (typeof opciones)[number]["valor"];

export function FiltroVencimiento({
  id,
  valor,
  texto,
  placeholder,
  onChange,
}: {
  id: string;
  valor: FiltroVencimientoValor;
  texto: string;
  placeholder: string;
  onChange: (valor: FiltroVencimientoValor, texto: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(-1);
  const opcionActiva = opciones[activo];
  const valorVisible =
    valor === "todos"
      ? texto
      : opciones.find((opcion) => opcion.valor === valor)?.etiqueta;

  function cerrar() {
    setAbierto(false);
    setActivo(-1);
  }

  function elegir(estado: FiltroVencimientoValor) {
    flushSync(() => {
      onChange(estado, "");
      cerrar();
    });
    input.current?.select();
  }

  return (
    <div
      className={styles.control}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) cerrar();
      }}
    >
      <input
        id={id}
        ref={input}
        role="combobox"
        autoComplete="off"
        aria-autocomplete="none"
        aria-expanded={abierto}
        aria-controls={abierto ? `${id}-opciones` : undefined}
        aria-activedescendant={
          abierto && opcionActiva ? `${id}-${opcionActiva.valor}` : undefined
        }
        value={valorVisible}
        placeholder={placeholder}
        maxLength={200}
        onClick={(event) => {
          if (valor !== "todos") event.currentTarget.select();
        }}
        onFocus={(event) => {
          if (valor !== "todos") event.currentTarget.select();
        }}
        onChange={(event) => {
          onChange("todos", event.target.value);
          cerrar();
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape" && abierto) {
            event.preventDefault();
            cerrar();
          } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setAbierto(true);
            setActivo((actual) =>
              event.key === "ArrowDown"
                ? Math.min(actual + 1, opciones.length - 1)
                : actual < 0
                  ? opciones.length - 1
                  : Math.max(actual - 1, 0),
            );
          } else if (event.key === "Enter" && abierto && opcionActiva) {
            event.preventDefault();
            elegir(opcionActiva.valor);
          }
        }}
      />
      <button
        type="button"
        className={styles.flecha}
        tabIndex={-1}
        aria-label={
          abierto
            ? "Cerrar opciones de vencimiento"
            : "Abrir opciones de vencimiento"
        }
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          input.current?.focus();
          if (abierto) cerrar();
          else setAbierto(true);
        }}
      >
        <ChevronDown size={16} />
      </button>
      {abierto && (
        <div className={styles.menu}>
          <ul
            id={`${id}-opciones`}
            role="listbox"
            aria-label="Opciones de vencimiento"
          >
            {opciones.map((opcion, index) => (
              <li
                key={opcion.valor}
                id={`${id}-${opcion.valor}`}
                role="option"
                aria-selected={opcion.valor === valor && !texto}
                data-activo={index === activo}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => elegir(opcion.valor)}
              >
                {opcion.etiqueta}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

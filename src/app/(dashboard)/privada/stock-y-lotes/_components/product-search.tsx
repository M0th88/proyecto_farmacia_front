"use client";
import { Check } from "lucide-react";
import { type Ref, useRef, useState } from "react";
import type { StockOptions } from "@/lib/types/stock-y-lotes";
import styles from "./product-search.module.css";

const normalize = (value: string) =>
  value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("es");
type Product = StockOptions["productos"][number];

export function ProductSearch({
  id,
  products,
  value,
  onChange,
  onBlur,
  inputRef,
  disabled,
  invalid,
  describedBy,
}: {
  id: string;
  products: Product[];
  value: number;
  onChange: (value: number) => void;
  onBlur: () => void;
  inputRef: Ref<HTMLInputElement>;
  disabled: boolean;
  invalid: boolean;
  describedBy?: string;
}) {
  const selected = products.find((product) => product.id === value);
  const [search, setSearch] = useState(selected?.nombre ?? "");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const matches = products.filter((product) =>
    normalize(`${product.nombre} ${product.codigoBarra ?? ""}`).includes(
      normalize(search.trim()),
    ),
  );
  const choose = (product: Product) => {
    setSearch(product.nombre);
    onChange(product.id);
    setOpen(false);
  };
  const move = (direction: number) => {
    const next = !open
      ? direction > 0
        ? 0
        : matches.length - 1
      : (activeIndex + direction + matches.length) % matches.length;
    setOpen(true);
    setActiveIndex(next);
    listRef.current?.children[next]?.scrollIntoView({ block: "nearest" });
  };
  return (
    <div className={styles.container}>
      <input
        id={id}
        ref={inputRef}
        role="combobox"
        autoComplete="off"
        placeholder="Buscar producto por nombre o código"
        value={search}
        disabled={disabled}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        aria-expanded={open}
        aria-controls={`${id}-results`}
        aria-autocomplete="list"
        aria-activedescendant={
          open && matches[activeIndex]
            ? `${id}-option-${matches[activeIndex].id}`
            : undefined
        }
        onFocus={() => {
          setOpen(true);
          setActiveIndex(0);
        }}
        onBlur={() => {
          setOpen(false);
          onBlur();
        }}
        onChange={(event) => {
          setSearch(event.target.value);
          setActiveIndex(0);
          setOpen(true);
          if (value !== 0) onChange(0);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (matches.length) move(event.key === "ArrowDown" ? 1 : -1);
          } else if (event.key === "Enter" && open) {
            event.preventDefault();
            if (matches[activeIndex]) choose(matches[activeIndex]);
          } else if (event.key === "Escape" && open) {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
          }
        }}
      />
      {open && (
        <div className={styles.popup}>
          <ul
            id={`${id}-results`}
            className={styles.list}
            role="listbox"
            aria-label="Productos encontrados"
            ref={listRef}
          >
            {matches.map((product, index) => (
              <li
                key={product.id}
                id={`${id}-option-${product.id}`}
                role="option"
                aria-selected={product.id === value}
                className={`${styles.option} ${activeIndex === index ? styles.active : ""}`}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(product)}
              >
                <span>
                  {product.nombre}
                  <small>{product.codigoBarra ?? `ID ${product.id}`}</small>
                </span>
                {product.id === value && <Check size={16} aria-hidden="true" />}
              </li>
            ))}
          </ul>
          {!matches.length && (
            <p className={styles.empty} role="status">
              No se encontraron productos.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

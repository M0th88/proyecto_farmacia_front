"use client";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  LoaderCircle,
  RefreshCw,
  SearchX,
} from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useDebounce } from "@/hooks/use-debounce";
import type { PaginationResponse } from "@/lib/types/pagination";
import styles from "./data-table.module.css";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";

type Props<T> = {
  columns: ColumnDef<T>[];
  queryKey: readonly unknown[];
  queryFn: (options: {
    pageParam: number;
    search: string;
    sorting: SortingState;
    signal?: AbortSignal;
  }) => Promise<PaginationResponse<T>>;
  placeholder: string;
  createButton?: ReactNode;
  emptyTitle: string;
  getRowId: (row: T) => string;
};

export function DataTable<T>({
  columns,
  queryKey,
  queryFn,
  placeholder,
  createButton,
  emptyTitle,
  getRowId,
}: Props<T>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);
  const [sorting, setSorting] = useState<SortingState>([]);
  const query = useInfiniteQuery({
    queryKey: [...queryKey, debouncedSearch, sorting],
    queryFn: ({ pageParam, signal }) =>
      queryFn({ pageParam, search: debouncedSearch, sorting, signal }),
    initialPageParam: 0,
    getNextPageParam: (page) => page.nextPage ?? undefined,
    placeholderData: keepPreviousData,
  });
  const data = useMemo(
    () => query.data?.pages.flatMap((page) => page.data) ?? [],
    [query.data],
  );
  const total = query.data?.pages[0]?.totalRows ?? 0;
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table mantiene una instancia mutable; React Compiler no debe memorizarla.
  const table = useReactTable({
    data,
    columns,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualFiltering: true,
    state: { sorting },
    onSortingChange: setSorting,
  });
  const rows = table.getRowModel().rows;
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 58,
    overscan: 8,
    getItemKey: (index) => rows[index]?.id ?? index,
  });
  const { hasNextPage, isFetching, isPlaceholderData, isError, fetchNextPage } =
    query;
  const loadMore = useCallback(() => {
    const element = scrollRef.current;
    if (
      element &&
      element.scrollHeight - element.scrollTop - element.clientHeight < 500 &&
      hasNextPage &&
      !isFetching &&
      !isPlaceholderData &&
      !isError
    )
      void fetchNextPage();
  }, [hasNextPage, isFetching, isPlaceholderData, isError, fetchNextPage]);
  useEffect(loadMore, [loadMore, data.length]);
  const resetScroll = () => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  };
  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <div className={styles.search}>
          <label htmlFor={id}>Filtrar</label>
          <input
            id={id}
            value={search}
            placeholder={placeholder}
            onChange={(event) => {
              resetScroll();
              setSearch(event.target.value);
            }}
          />
        </div>
        <div className={styles.toolbarActions}>
          <Button
            variant="outline"
            aria-label="Actualizar usuarios"
            title="Actualizar usuarios"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            <RefreshCw size={16} />
          </Button>
          {createButton}
        </div>
      </div>
      {query.isPending ? (
        <TableSkeleton
          headers={columns.map((column) =>
            typeof column.header === "string"
              ? column.header
              : (column.id ?? "Columna"),
          )}
        />
      ) : query.isError && !data.length ? (
        <div className={styles.empty} role="alert">
          <p>{query.error.message}</p>
          <Button onClick={() => void query.refetch()}>Reintentar</Button>
        </div>
      ) : (
        <>
          <div
            className={styles.scroll}
            ref={scrollRef}
            onScroll={loadMore}
            aria-label="Tabla de usuarios; desplazamiento horizontal y vertical"
            tabIndex={0}
          >
            <table
              className={styles.table}
              style={{
                minWidth: table.getTotalSize() + (columns.length - 1) * 16,
              }}
              aria-rowcount={total + 1}
              aria-label="Usuarios de Farmacia Privada"
              aria-busy={query.isFetching}
            >
              <thead className={styles.header}>
                {table.getHeaderGroups().map((group) => (
                  <tr key={group.id} className={styles.row}>
                    {group.headers.map((header) => (
                      <th
                        key={header.id}
                        scope="col"
                        style={{ width: header.getSize() }}
                        aria-sort={
                          header.column.getIsSorted() === "asc"
                            ? "ascending"
                            : header.column.getIsSorted() === "desc"
                              ? "descending"
                              : undefined
                        }
                      >
                        {header.column.getCanSort() ? (
                          <button
                            className={styles.sortButton}
                            onClick={() => {
                              resetScroll();
                              header.column.toggleSorting();
                            }}
                          >
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                            {header.column.getIsSorted() === "asc" ? (
                              <ArrowUp size={14} />
                            ) : header.column.getIsSorted() === "desc" ? (
                              <ArrowDown size={14} />
                            ) : (
                              <ArrowUpDown size={14} />
                            )}
                          </button>
                        ) : (
                          flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )
                        )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody
                className={styles.body}
                style={{
                  height: rows.length ? virtualizer.getTotalSize() : 120,
                }}
              >
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const row = rows[virtualRow.index];
                  return (
                    <tr
                      key={row.id}
                      data-index={virtualRow.index}
                      ref={(element) => virtualizer.measureElement(element)}
                      className={`${styles.row} ${styles.virtualRow}`}
                      style={{ transform: `translateY(${virtualRow.start}px)` }}
                      aria-rowindex={virtualRow.index + 2}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          style={{ width: cell.column.getSize() }}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
                {!rows.length && (
                  <tr>
                    <td colSpan={columns.length} className={styles.noResults}>
                      <SearchX size={24} aria-hidden="true" />
                      <p>
                        {debouncedSearch
                          ? "No hay resultados para tu búsqueda."
                          : emptyTitle}
                      </p>
                      {debouncedSearch && (
                        <Button variant="outline" onClick={() => setSearch("")}>
                          Limpiar búsqueda
                        </Button>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className={styles.footer} role="status">
            <span>
              {data.length} de {total} usuarios
              {debouncedSearch ? " encontrados" : ""}
            </span>
            {query.isFetching && (
              <span className={styles.loading}>
                <LoaderCircle size={16} className={styles.spinner} />
                {query.isFetchingNextPage
                  ? "Cargando más usuarios…"
                  : "Actualizando…"}
              </span>
            )}
            {query.hasNextPage && (
              <Button
                variant="outline"
                disabled={query.isFetching}
                onClick={() => void query.fetchNextPage()}
              >
                Cargar más
              </Button>
            )}
          </div>
          {query.isError && data.length > 0 && (
            <div className={styles.footer} role="alert">
              <span>{query.error.message}</span>
              <Button variant="outline" onClick={() => void query.refetch()}>
                Reintentar
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function TableSkeleton({ headers }: { headers: readonly string[] }) {
  return (
    <div
      className={styles.skeletonWrap}
      role="status"
      aria-label="Cargando tabla de usuarios"
    >
      <table className={styles.skeletonTable}>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 10 }, (_, index) => (
            <tr key={`skeleton-${index}`}>
              {headers.map((header) => (
                <td key={header}>
                  <Skeleton />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

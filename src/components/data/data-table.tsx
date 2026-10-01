import type { ReactNode } from "react";
import { Button, EmptyState, ErrorState, Input, Label, Select, Skeleton } from "@/components/ui";
import { hasDataFilters, MAX_PAGE, PAGE_SIZES, queryHref, type DataQuery, type FilterDefinition } from "@/lib/data-query";

export type DataColumn<Row> = {
  id: string; header: string; cell: (row: Row) => ReactNode;
  align?: "left" | "center" | "right";
  // Trusted public key, also allowlisted by the server query configuration.
  sortKey?: string;
};
export function DataTable<Row>({ caption, rows, columns, rowKey, query, actions }: {
  caption: string; rows: readonly Row[]; columns: readonly DataColumn<Row>[];
  rowKey: (row: Row) => string; query: DataQuery; actions?: (row: Row) => ReactNode;
}) {
  if (!rows.length && query.page > 1) return <div role="status"><EmptyState title="Halaman ini tidak tersedia" description="Kembali ke halaman pertama untuk melihat data." action={<a className="ui-button ui-button-outline" href={queryHref(query, { page: 1 })}>Halaman pertama</a>} /></div>;
  if (!rows.length) return <DataFeedback state={hasDataFilters(query) ? "no-results" : "empty"} />;
  return <div className="data-scroll" role="region" aria-label={caption} tabIndex={0}>
    <table className="data-table"><caption>{caption}</caption><thead><tr>{columns.map(column => {
      const active = column.sortKey === query.sort;
      return <th key={column.id} scope="col" style={{ textAlign: column.align ?? "left" }} aria-sort={column.sortKey ? active ? query.direction === "asc" ? "ascending" : "descending" : "none" : undefined}>
        {column.sortKey ? <a className="data-sort" href={queryHref(query, { page: 1, sort: column.sortKey, direction: active && query.direction === "asc" ? "desc" : "asc" })} aria-label={`Urutkan ${column.header} ${active && query.direction === "asc" ? "menurun" : "menaik"}`}>{column.header}{active && <span aria-hidden="true">{query.direction === "asc" ? " ↑" : " ↓"}</span>}</a> : column.header}
      </th>;
    })}{actions && <th scope="col">Tindakan</th>}</tr></thead><tbody>{rows.map(row => <tr key={rowKey(row)}>{columns.map(column => {
      const value = column.cell(row);
      return <td key={column.id} style={{ textAlign: column.align ?? "left" }}>{value === null || value === undefined || value === "" ? <span className="muted">Belum diisi</span> : value}</td>;
    })}{actions && <td><div className="data-actions">{actions(row)}</div></td>}</tr>)}</tbody></table>
  </div>;
}

// Native GET submission works without hydration, debouncing or per-key requests.
// Give each toolbar a unique id. Changing controls intentionally resets page.
export function DataToolbar({ id, query, filters = [] }: { id: string; query: DataQuery; filters?: readonly FilterDefinition[] }) {
  return <form method="get" className="data-toolbar" role="search" aria-label="Cari dan saring data">
    <input type="hidden" name="page" value="1" /><input type="hidden" name="sort" value={query.sort} /><input type="hidden" name="direction" value={query.direction} />
    <div><Label htmlFor={`${id}-q`}>Cari data</Label><Input id={`${id}-q`} name="q" type="search" maxLength={200} defaultValue={query.q} placeholder="Masukkan kata pencarian" /></div>
    {filters.map(filter => <div key={filter.key}><Label htmlFor={`${id}-${filter.key}`}>{filter.label}</Label><Select id={`${id}-${filter.key}`} name={`filter.${filter.key}`} defaultValue={query.filters[filter.key] ?? ""}><option value="">Semua</option>{filter.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></div>)}
    <div><Label htmlFor={`${id}-size`}>Baris per halaman</Label><Select id={`${id}-size`} name="pageSize" defaultValue={query.pageSize}>{PAGE_SIZES.map(size => <option key={size} value={size}>{size}</option>)}</Select></div>
    <Button type="submit">Terapkan</Button><a className="ui-button ui-button-outline" href={queryHref(query, { page: 1, q: "", filters: {} })}>Hapus pencarian dan filter</a>
    {hasDataFilters(query) && <p className="data-filter-status" role="status">Pencarian atau filter aktif.</p>}
  </form>;
}

export function DataPagination({ query, total }: { query: DataQuery; total: number }) {
  if (!Number.isSafeInteger(total) || total < 0) throw new Error("Invalid pagination total");
  const pages = Math.max(1, Math.ceil(total / query.pageSize));
  // An out-of-range URL stays honest: no fictitious rows/page clamping. Offer recovery.
  return <nav className="data-pagination" aria-label="Halaman data">
    {query.page > 1 ? <a className="ui-button ui-button-outline" rel="prev" href={queryHref(query, { page: Math.min(query.page - 1, pages) })}>Sebelumnya</a> : <Button disabled variant="outline">Sebelumnya</Button>}
    <p aria-current="page">Halaman {query.page} dari {pages} · {total} data</p>
    {query.page < pages && query.page < MAX_PAGE ? <a className="ui-button ui-button-outline" rel="next" href={queryHref(query, { page: query.page + 1 })}>Berikutnya</a> : <Button disabled variant="outline">Berikutnya</Button>}
    {query.page === MAX_PAGE && pages > MAX_PAGE && <p role="status">Gunakan pencarian atau filter untuk mempersempit hasil.</p>}
    {query.page > pages && <p role="status">Halaman ini tidak tersedia. <a className="data-sort" href={queryHref(query, { page: 1 })}>Kembali ke halaman pertama</a></p>}
  </nav>;
}

export function DataFeedback({ state, action }: { state: "loading" | "empty" | "no-results" | "error"; action?: ReactNode }) {
  if (state === "loading") return <div aria-busy="true" className="ui-card"><p role="status">Memuat data...</p><Skeleton className="mt-4 h-8" /><Skeleton className="mt-4 h-8" /><Skeleton className="mt-4 h-8" /></div>;
  if (state === "error") return <div role="alert"><ErrorState action={action} /></div>;
  return <div role="status"><EmptyState title={state === "empty" ? "Belum ada data" : "Tidak ada hasil yang cocok"} description={state === "empty" ? "Data akan tampil di sini setelah tersedia." : "Coba kata pencarian lain atau hapus filter."} action={action} /></div>;
}

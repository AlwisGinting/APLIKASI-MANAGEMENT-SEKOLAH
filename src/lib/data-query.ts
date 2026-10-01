export type SearchParams = Record<string, string | string[] | undefined>;
export type Direction = "asc" | "desc";
export type FilterDefinition = { key: string; label: string; options: readonly { value: string; label: string }[] };
export type QueryConfig = {
  sorts: readonly string[];
  defaultSort: string;
  filters: readonly FilterDefinition[];
};
export type DataQuery = { page: number; pageSize: number; q: string; sort: string; direction: Direction; filters: Record<string, string> };
export const PAGE_SIZES = [10, 25, 50] as const;
export const MAX_PAGE = 100000;
const scalar = (value: string | string[] | undefined) => typeof value === "string" ? value : "";

// URL input is not a database identifier. Callers supply the trusted schema.
export function parseDataQuery(params: SearchParams, config: QueryConfig): DataQuery {
  if (!config.sorts.includes(config.defaultSort)) throw new Error("Invalid query configuration");
  const page = scalar(params.page);
  const size = Number(scalar(params.pageSize));
  const filters: Record<string, string> = {};
  for (const filter of config.filters) {
    const value = scalar(params[`filter.${filter.key}`]);
    if (value && filter.options.some(option => option.value === value)) Object.defineProperty(filters, filter.key, { value, enumerable: true });
  }
  return {
    page: /^[1-9]\d{0,5}$/.test(page) && Number(page) <= MAX_PAGE ? Number(page) : 1,
    pageSize: PAGE_SIZES.includes(size as typeof PAGE_SIZES[number]) ? size : 25,
    q: scalar(params.q).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 200),
    sort: config.sorts.includes(scalar(params.sort)) ? scalar(params.sort) : config.defaultSort,
    direction: scalar(params.direction) === "desc" ? "desc" : "asc",
    filters,
  };
}
export function queryParams(query: DataQuery): URLSearchParams {
  const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize), sort: query.sort, direction: query.direction });
  if (query.q) params.set("q", query.q);
  for (const [key, value] of Object.entries(query.filters)) params.set(`filter.${key}`, value);
  return params;
}
export function queryHref(query: DataQuery, patch: Partial<DataQuery> = {}): string {
  return `?${queryParams({ ...query, ...patch }).toString()}`;
}
export function hasDataFilters(query: DataQuery): boolean { return Boolean(query.q || Object.keys(query.filters).length); }

// No database access here. Map public sort keys to hard-coded fields in the
// server adapter, then enforce authorization/tenant scope before fetching.
export function serverQuery<Field extends string>(params: SearchParams, config: QueryConfig, fields: Readonly<Record<string, Field>>, uniqueField: Field) {
  const state = parseDataQuery(params, config);
  if (!Object.hasOwn(fields, state.sort)) throw new Error("Missing sort mapping");
  const field = fields[state.sort];
  const order: { field: Field; direction: Direction }[] = [{ field, direction: state.direction }];
  if (field !== uniqueField) order.push({ field: uniqueField, direction: "asc" });
  const offset = (state.page - 1) * state.pageSize;
  return { state, offset, limit: state.pageSize, order };
}
export type DataPage<Row> = { rows: readonly Row[]; total: number };

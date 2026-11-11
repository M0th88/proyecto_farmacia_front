export type PaginationResponse<T> = {
  data: T[];
  totalRows: number;
  nextPage: number | null;
};

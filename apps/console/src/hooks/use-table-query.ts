import { useCallback, useMemo, useState } from "react";

/** ProTable `request` 回调入参（含分页与搜索表单项） */
export type ProTableRequestParams = Record<string, unknown> & {
  current?: number;
  pageSize?: number;
};

export type UseTableQueryOptions = {
  /** 初始页码，默认 1 */
  defaultCurrent?: number;
  /** 初始每页条数，默认 10 */
  defaultPageSize?: number;
  /** 单页最大条数（与后端约定，如 100），默认 100 */
  maxPageSize?: number;
};

export type TableListParams = {
  current: number;
  pageSize: number;
  limit: number;
  offset: number;
};

/**
 * 从 ProTable 的 params 中解析分页，得到 limit / offset（会做 maxPageSize 裁剪）
 */
export function normalizeProTablePaging(
  params: ProTableRequestParams,
  options?: { maxPageSize?: number; fallbackCurrent?: number; fallbackPageSize?: number },
): TableListParams {
  const maxPageSize = options?.maxPageSize ?? 100;
  const fallbackCurrent = options?.fallbackCurrent ?? 1;
  const fallbackPageSize = options?.fallbackPageSize ?? 10;
  const current = Math.max(1, Number(params.current ?? fallbackCurrent));
  const rawSize = Number(params.pageSize ?? fallbackPageSize);
  const pageSize = Math.min(Math.max(1, rawSize), maxPageSize);
  const limit = pageSize;
  const offset = (current - 1) * limit;
  return { current, pageSize, limit, offset };
}

/**
 * 封装表格常见能力：分页状态、与 ProTable 同步、搜索字段抽取、可选「手动筛选」状态。
 *
 * @example
 * ```tsx
 * const { proTablePagination, rowIndexBase, getListParams } = useTableQuery({ maxPageSize: 100 });
 *
 * <ProTable
 *   pagination={proTablePagination}
 *   request={async (params) => {
 *     const { limit, offset, name } = getListParams(params, ['name']);
 *     const res = await listApi({ limit, offset, name });
 *     return { data: res.data, success: true, total: res.total };
 *   }}
 * />
 * ```
 */
export function useTableQuery<
  TManualFilters extends Record<string, unknown> = Record<string, never>,
>(options?: UseTableQueryOptions) {
  const {
    defaultCurrent = 1,
    defaultPageSize = 10,
    maxPageSize = 100,
  } = options ?? {};

  const [current, setCurrent] = useState(defaultCurrent);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [manualFilters, setManualFilters] = useState<Partial<TManualFilters>>({});

  const handlePaginationChange = useCallback((page: number, size?: number) => {
    setCurrent(page);
    if (size != null) {
      setPageSize(size);
    }
  }, []);

  const proTablePagination = useMemo(
    () => ({
      current,
      pageSize,
      defaultPageSize,
      showSizeChanger: true as const,
      pageSizeOptions: ["10", "20", "50", "100"],
      showTotal: (total: number) => `共 ${total} 条`,
      onChange: handlePaginationChange,
      onShowSizeChange: handlePaginationChange,
    }),
    [current, pageSize, defaultPageSize, handlePaginationChange],
  );

  const rowIndexBase = (current - 1) * pageSize;

  /**
   * 合并：受控分页 + 手动筛选 + 从 ProTable params 中按 key 抽取的搜索项（忽略空字符串）
   */
  const getListParams = useCallback(
    <K extends string = string>(
      proParams: ProTableRequestParams,
      searchKeys: readonly K[] = [],
    ): TableListParams & Record<K, unknown> & Partial<TManualFilters> => {
      const paging = normalizeProTablePaging(proParams, {
        maxPageSize,
        fallbackCurrent: current,
        fallbackPageSize: pageSize,
      });

      const fromForm: Record<string, unknown> = {};
      for (const key of searchKeys) {
        const v = proParams[key];
        if (v !== undefined && v !== null && v !== "") {
          fromForm[key] = v;
        }
      }

      return {
        ...paging,
        ...manualFilters,
        ...fromForm,
      } as TableListParams & Record<K, unknown> & Partial<TManualFilters>;
    },
    [current, pageSize, maxPageSize, manualFilters],
  );

  const setPagination = useCallback((page: number, size: number) => {
    setCurrent(page);
    setPageSize(size);
  }, []);

  const resetPagination = useCallback(() => {
    setCurrent(defaultCurrent);
    setPageSize(defaultPageSize);
  }, [defaultCurrent, defaultPageSize]);

  const resetManualFilters = useCallback(() => {
    setManualFilters({});
  }, []);

  const resetAll = useCallback(() => {
    resetPagination();
    resetManualFilters();
  }, [resetPagination, resetManualFilters]);

  return {
    /** 当前页码 */
    current,
    /** 每页条数 */
    pageSize,
    setCurrent,
    setPageSize,
    setPagination,
    /** 工具栏 / 自定义区域写入的筛选（与 ProTable 搜索表单无关时可使用） */
    manualFilters,
    setManualFilters,
    resetManualFilters,
    resetPagination,
    /** 分页 + 手动筛选一并重置 */
    resetAll,
    /** 直接传给 ProTable 的 pagination */
    proTablePagination,
    /** 当前页「序号」列基准：(current - 1) * pageSize */
    rowIndexBase,
    /** 解析本次请求的分页 + 搜索 + manualFilters */
    getListParams,
  };
}

import { vi } from "vitest";

type QueryResult = {
  data?: unknown;
  error?: { message?: string; code?: string } | null;
};

type SupabaseMockOptions = {
  authUser?: { id: string } | null;
  byTable?: Record<string, QueryResult>;
  defaultResult?: QueryResult;
};

function cloneResult(result: QueryResult) {
  return { data: result.data ?? null, error: result.error ?? null };
}

function createBuilder(result: QueryResult) {
  const finalResult = cloneResult(result);

  const builder = {
    select: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => finalResult),
    single: vi.fn(async () => finalResult),
    then: (resolve: (value: QueryResult) => unknown) => Promise.resolve(finalResult).then(resolve)
  };

  return builder;
}

export function createSupabaseMock(options: SupabaseMockOptions = {}) {
  const byTable = options.byTable ?? {};
  const defaultResult = options.defaultResult ?? { data: null, error: null };

  const from = vi.fn((table: string) => createBuilder(byTable[table] ?? defaultResult));

  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: options.authUser ?? { id: "user-operator-1" } }
      }))
    },
    from,
    storage: {
      from: vi.fn(() => ({
        download: vi.fn(async () => ({ data: new Blob([JSON.stringify({})]), error: null })),
        upload: vi.fn(async () => ({ data: null, error: null }))
      }))
    }
  };
}

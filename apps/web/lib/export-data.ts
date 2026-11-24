import type { ExportRows } from "./export";

export const ROW_CAP = 10000;

export class ExportError extends Error {
  constructor(
    readonly kind: "query" | "too_large",
    message: string,
  ) {
    super(message);
  }
}

type Result = { data: unknown[] | null; error: unknown };
// Structural type: the real Supabase client fits it, tests use a small fake.
export const PAGE = 1000; // PostgREST max_rows default
export type ExportClient = {
  from(table: string): {
    select(cols: string): {
      eq(
        col: string,
        v: string,
      ): { order(col: string): { range(from: number, to: number): PromiseLike<Result> } };
    };
  };
};

async function rows(db: ExportClient, table: string, cols: string, col: string, userId: string) {
  const all: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from(table)
      .select(cols)
      .eq(col, userId)
      .order("id")
      .range(from, from + PAGE - 1);
    if (error || !data) throw new ExportError("query", `query failed: ${table}`);
    all.push(...(data as Record<string, unknown>[]));
    // Never truncate silently: reaching the cap fails the export.
    if (all.length >= ROW_CAP) throw new ExportError("too_large", `too large: ${table}`);
    if (data.length < PAGE) return all;
  }
}

/** Uses the signed-in user's client: RLS applies. The eq on user_id is a second guard. */
export async function loadExport(db: ExportClient, userId: string): Promise<ExportRows> {
  const [profile, subscriptions, reminders, feedback, audit_log, push_subscriptions] =
    await Promise.all([
      rows(db, "profiles", "*", "id", userId),
      rows(db, "subscriptions", "*", "user_id", userId),
      rows(db, "reminders", "*", "user_id", userId),
      rows(db, "feedback", "*", "user_id", userId),
      rows(db, "audit_log", "*", "user_id", userId),
      // Endpoint only. The keys column holds secrets.
      rows(db, "push_subscriptions", "id,endpoint,created_at", "user_id", userId),
    ]);
  return {
    userId,
    profile: profile[0] ?? null,
    subscriptions,
    reminders,
    feedback,
    audit_log,
    push_subscriptions,
  };
}

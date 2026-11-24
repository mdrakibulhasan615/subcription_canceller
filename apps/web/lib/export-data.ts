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
export type ExportClient = {
  from(table: string): {
    select(cols: string): { eq(col: string, v: string): { limit(n: number): PromiseLike<Result> } };
  };
};

async function rows(db: ExportClient, table: string, cols: string, col: string, userId: string) {
  const { data, error } = await db.from(table).select(cols).eq(col, userId).limit(ROW_CAP);
  if (error || !data) throw new ExportError("query", `query failed: ${table}`);
  // Never truncate silently: a full page means there may be more.
  if (data.length >= ROW_CAP) throw new ExportError("too_large", `too large: ${table}`);
  return data as Record<string, unknown>[];
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

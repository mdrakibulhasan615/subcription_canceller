// Pure handler: no Deno or npm imports, so Vitest can run it with fakes.

export type Outcome = "sent" | "skipped" | "retry";
export type Status = "pending" | "sent" | "failed" | "skipped";

export interface ClaimedReminder {
  id: string;
  userId: string;
  type: string;
  channel: string;
  userEmail: string | null;
  subName: string;
  subInactive: boolean;
  attempts: number;
  fireAt: string;
}

export interface ChannelSender {
  /** Throws on failure. */
  send(r: ClaimedReminder): Promise<void>;
}

export interface SenderDb {
  claim(batch: number): Promise<ClaimedReminder[]>;
  mark(id: string, outcome: Outcome, error?: string): Promise<Status>;
}

export interface Alerter {
  alert(r: ClaimedReminder, error: string): Promise<void>;
}

export interface RunDeps {
  db: SenderDb;
  senders: Record<string, ChannelSender | undefined>;
  alerter: Alerter;
  batch?: number;
}

export interface RunResult {
  claimed: number;
  sent: number;
  retried: number;
  failed: number;
  skipped: number;
}

const MAX_BATCH = 200;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function runDueReminders({
  db,
  senders,
  alerter,
  batch = 50,
}: RunDeps): Promise<RunResult> {
  const size = Math.min(Math.max(Math.trunc(batch) || 0, 1), MAX_BATCH);
  const rows = await db.claim(size);
  const res: RunResult = { claimed: rows.length, sent: 0, retried: 0, failed: 0, skipped: 0 };

  for (const r of rows) {
    try {
      if (r.subInactive) {
        await db.mark(r.id, "skipped");
        res.skipped++;
        continue;
      }
      let error: string | null = null;
      try {
        const sender = senders[r.channel];
        if (!sender) throw new Error(`no sender for channel ${r.channel}`);
        if (r.channel === "email" && !r.userEmail) throw new Error("user has no email");
        await sender.send(r);
      } catch (e) {
        error = msg(e);
      }
      if (error === null) {
        await db.mark(r.id, "sent");
        res.sent++;
        continue;
      }
      const status = await db.mark(r.id, "retry", error);
      if (status === "failed") {
        res.failed++;
        try {
          await alerter.alert(r, error);
        } catch (e) {
          console.error("failed-alert error", msg(e));
        }
      } else {
        res.retried++;
      }
    } catch (e) {
      // A db error on one row must not stop the batch. The lease ends and the row returns.
      console.error("reminder error", r.id, msg(e));
    }
  }
  return res;
}

/** Constant-time string compare. Length is not hidden. */
export function secretsMatch(given: string | null, expected: string | undefined): boolean {
  if (!given || !expected) return false;
  const a = new TextEncoder().encode(given);
  const b = new TextEncoder().encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return diff === 0;
}

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/** HTTP layer. Checks method and secret before the db is touched. */
export async function handleRequest(
  req: Request,
  cronSecret: string | undefined,
  run: () => Promise<RunResult>,
): Promise<Response> {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  if (!secretsMatch(req.headers.get("x-cron-secret"), cronSecret)) {
    return json({ error: "unauthorized" }, 401);
  }
  try {
    return json(await run(), 200);
  } catch (e) {
    console.error("run failed", msg(e));
    return json({ error: "internal error" }, 500);
  }
}

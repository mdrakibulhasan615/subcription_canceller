const WINDOW_MS = 10 * 60 * 1000;
const MAX = 5;

// shortcut: per-instance in-memory, resets on cold start, not shared across instances, spoofable via x-forwarded-for, upgrade to Upstash or Supabase if abused
const hits = new Map<string, number[]>();

export function rateLimit(
  key: string,
  now: number = Date.now(),
): { ok: boolean; retryAfterSec: number } {
  for (const [k, ts] of hits) {
    const live = ts.filter((t) => now - t < WINDOW_MS);
    if (live.length === 0) hits.delete(k);
    else hits.set(k, live);
  }
  const ts = hits.get(key) ?? [];
  if (ts.length >= MAX) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((ts[0]! + WINDOW_MS - now) / 1000)) };
  }
  ts.push(now);
  hits.set(key, ts);
  return { ok: true, retryAfterSec: 0 };
}

export function _resetRateLimit() {
  hits.clear();
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || req.headers.get("x-real-ip")?.trim() || "unknown";
}

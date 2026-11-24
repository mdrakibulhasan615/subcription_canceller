import { clientIp, rateLimit } from "../../../lib/rate-limit";
import { getAnonClient, joinWaitlist, waitlistSchema } from "../../../lib/waitlist";

function json(body: object, status = 200, headers?: Record<string, string>) {
  return Response.json(body, { status, headers });
}

export async function POST(req: Request) {
  const limit = rateLimit(clientIp(req));
  if (!limit.ok) {
    return json({ ok: false, error: "rate_limited" }, 429, {
      "Retry-After": String(limit.retryAfterSec),
    });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "invalid_email" }, 400);
  }
  // Honeypot: bots get the same 200, nothing is stored.
  if (typeof body === "object" && body !== null && "website" in body && body.website) {
    return json({ ok: true });
  }
  const parsed = waitlistSchema.safeParse(body);
  if (!parsed.success) return json({ ok: false, error: "invalid_email" }, 400);
  try {
    await joinWaitlist(getAnonClient(), parsed.data.email, parsed.data.source);
    return json({ ok: true });
  } catch {
    return json({ ok: false, error: "server" }, 500);
  }
}

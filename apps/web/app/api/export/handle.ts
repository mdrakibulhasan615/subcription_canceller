import { BRAND } from "@app/core";
import { buildJsonExport, subscriptionsToCsv } from "../../../lib/export";
import { ExportError, loadExport, type ExportClient } from "../../../lib/export-data";
import { rateLimit } from "../../../lib/rate-limit";
import { createClient, getClaims } from "../../../lib/supabase/server";
import { track } from "../../../lib/track";

function err(error: string, status: number, headers?: Record<string, string>) {
  return Response.json({ error }, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

export async function exportResponse(kind: "json" | "csv"): Promise<Response> {
  const claims = await getClaims();
  if (!claims || typeof claims.sub !== "string") return err("Sign in to export.", 401);
  const userId = claims.sub;

  const limit = rateLimit(`export:${userId}`);
  if (!limit.ok) {
    return err("Too many exports. Try again later.", 429, {
      "Retry-After": String(limit.retryAfterSec),
    });
  }

  let body: string;
  try {
    // Cast: the full Supabase client type is too deep for tsc to compare.
    const supabase = await createClient();
    const db = supabase as unknown as ExportClient;
    const rows = await loadExport(db, userId);
    const now = new Date();
    // shortcut: whole body in memory, no pagination or streaming, upgrade if a user nears the row cap.
    body =
      kind === "json"
        ? JSON.stringify(buildJsonExport(rows, now), null, 2)
        : subscriptionsToCsv(rows.subscriptions);
    const name = `${BRAND.toLowerCase()}-export-${now.toISOString().slice(0, 10)}.${kind}`;
    track(supabase, userId, "export_downloaded", { format: kind });
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type":
          kind === "json" ? "application/json; charset=utf-8" : "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return err(
      e instanceof ExportError && e.kind === "too_large"
        ? "Your data is too large to export here. Contact us."
        : "Export failed. Try again.",
      500,
    );
  }
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { GUIDE_FILES, guideSchema, type Guide, type GuideKind } from "@app/core";
import { getAnonClient } from "./waitlist";

const key = (g: { kind: string; service_slug: string }) => `${g.kind}/${g.service_slug}`;

/** Guides from the JSON files. Invalid files are skipped. */
export function fallbackGuides(): Guide[] {
  return Object.values(GUIDE_FILES).flatMap((raw) => {
    const r = guideSchema.safeParse(raw);
    return r.success ? [r.data] : [];
  });
}

/** DB rows win over JSON files. Missing env, DB error or invalid row: use the JSON file. Never throws. */
export async function loadGuides(): Promise<Guide[]> {
  const merged = new Map(fallbackGuides().map((g) => [key(g), g]));
  try {
    const { data, error } = await getAnonClient().from("guides").select("*");
    if (!error) {
      for (const row of data ?? []) {
        const r = guideSchema.safeParse(row);
        if (r.success) merged.set(key(r.data), r.data);
      }
    }
  } catch {
    // Fall back to the JSON files.
  }
  return [...merged.values()].sort((a, b) => a.title.localeCompare(b.title));
}

export async function loadGuide(kind: GuideKind, slug: string): Promise<Guide | null> {
  return (await loadGuides()).find((g) => g.kind === kind && g.service_slug === slug) ?? null;
}

/** Plain inserts only: anon has no SELECT on guide_reports. Returns not_found when the guide is not in the DB. */
export async function submitGuideReport(
  client: Pick<SupabaseClient, "from">,
  r: { kind: GuideKind; slug: string; message: string },
): Promise<"ok" | "not_found"> {
  const { data, error } = await client
    .from("guides")
    .select("id")
    .eq("kind", r.kind)
    .eq("service_slug", r.slug)
    .maybeSingle();
  if (error) throw new Error("guide lookup failed");
  if (!data) return "not_found";
  const ins = await client.from("guide_reports").insert({ guide_id: data.id, message: r.message });
  if (ins.error) throw new Error("report insert failed");
  return "ok";
}

export function siteBase(): URL {
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? (prod ? `https://${prod}` : "http://localhost:3000"),
  );
}

export const KIND_LABEL: Record<GuideKind, string> = {
  cancel: "Cancel guides",
  store: "Store guides",
  provider: "Provider guides",
};

// Upserts packages/core/src/guides-data/*.json into public.guides. Idempotent. Service role only.
import { createClient } from "@supabase/supabase-js";
import { GUIDE_FILES, guideSchema } from "../packages/core/src/index";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

const rows = Object.entries(GUIDE_FILES).map(([file, raw]) => {
  const r = guideSchema.safeParse(raw);
  if (!r.success) {
    console.error(`Invalid guide file ${file}: ${r.error.message}`);
    process.exit(1);
  }
  return { ...r.data, updated_at: undefined };
});

async function main() {
  const { error } = await supabase.from("guides").upsert(rows, { onConflict: "kind,service_slug" });
  if (error) {
    console.error(`Seed failed: ${error.message}`);
    process.exit(1);
  }
  console.log(`Seeded ${rows.length} guide(s).`);
}

void main();

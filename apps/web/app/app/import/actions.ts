"use server";

import { revalidatePath } from "next/cache";
import { createClient, getClaims } from "../../../lib/supabase/server";
import {
  AUTH_MESSAGE,
  commitImport,
  createImportDb,
  previewImport,
  type ImportState,
} from "../../../lib/csv-import";
import { userIdFrom } from "../../../lib/subscriptions";
import { track } from "../../../lib/track";

export async function importAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  try {
    const userId = userIdFrom(await getClaims());
    if (!userId) return { status: "error", message: AUTH_MESSAGE };
    const csv = formData.get("csv");
    if (typeof csv !== "string") return { status: "error", message: "Choose a CSV file first." };
    const supabase = await createClient();
    const db = createImportDb(supabase);
    if (formData.get("intent") === "import") {
      const r = await commitImport(db, userId, csv, new Date());
      if (!r.ok) return { status: "error", message: r.message };
      revalidatePath("/app/subscriptions");
      track(supabase, userId, "csv_imported", { count: Math.min(r.imported, 500) });
      return { status: "done", result: r };
    }
    const p = await previewImport(db, userId, csv, new Date());
    return p.ok ? { status: "preview", preview: p } : { status: "error", message: p.message };
  } catch {
    return { status: "error", message: "Something went wrong. Nothing was imported. Try again." };
  }
}

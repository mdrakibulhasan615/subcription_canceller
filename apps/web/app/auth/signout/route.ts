import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";

// Only POST is exported, so GET returns 405.
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // Still send the user home.
  }
  return NextResponse.redirect(`${new URL(request.url).origin}/`, 303);
}

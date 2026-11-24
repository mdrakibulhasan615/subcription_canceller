import { NextResponse, type NextRequest } from "next/server";
import { routeDecision } from "./lib/auth-routes";
import { updateSession } from "./lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const { response, isAuthed } = await updateSession(request);
  const d = routeDecision(request.nextUrl.pathname, request.nextUrl.search, isAuthed);
  if (d.type === "next") return response;
  const redirect = NextResponse.redirect(new URL(d.to, request.url));
  // Keep refreshed session cookies and cache headers on the redirect.
  response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
  const cc = response.headers.get("cache-control");
  if (cc) redirect.headers.set("cache-control", cc);
  return redirect;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|txt|xml|webmanifest)$).*)",
  ],
};

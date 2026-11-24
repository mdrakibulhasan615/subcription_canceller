import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { BRAND } from "@app/core";
import { Button } from "../../components/ui/button";
import { getClaims } from "../../lib/supabase/server";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const claims = await getClaims();
  // The proxy is not the only gate.
  if (!claims) redirect("/sign-in?next=%2Fapp");
  return (
    <>
      <a
        href="#main"
        className="absolute -top-20 left-4 z-100 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:top-4"
      >
        Skip to main content
      </a>
      <header className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4 md:px-6 lg:px-8">
        <span className="text-lg font-semibold">{BRAND}</span>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm break-all text-muted-foreground">
            {typeof claims.email === "string" ? claims.email : ""}
          </span>
          <form action="/auth/signout" method="post">
            <Button type="submit" variant="ghost" size="sm" className="min-h-11">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-5xl px-4 py-12 md:px-6 lg:px-8">
        {children}
      </main>
    </>
  );
}

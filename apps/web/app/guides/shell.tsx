import type { ReactNode } from "react";
import Link from "next/link";
import { BRAND } from "@app/core";

export function Shell({ children }: { children: ReactNode }) {
  return (
    <>
      <a
        href="#main"
        className="absolute -top-20 left-4 z-100 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:top-4"
      >
        Skip to main content
      </a>
      <header className="mx-auto max-w-5xl px-4 py-4 md:px-6 lg:px-8">
        <Link href="/" className="inline-flex min-h-11 items-center text-lg font-semibold">
          {BRAND}
        </Link>
      </header>
      <main id="main" className="mx-auto max-w-5xl px-4 pb-12 md:px-6 md:pb-24 lg:px-8">
        {children}
      </main>
      <footer className="mx-auto max-w-5xl px-4 py-8 text-sm text-muted-foreground md:px-6 lg:px-8">
        {BRAND}
      </footer>
    </>
  );
}

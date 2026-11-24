import type { LegalSection } from "../lib/legal";
import { CONTACT_EMAIL, LEGAL_BANNER, LEGAL_UPDATED } from "../lib/legal";
import { LegalLinks } from "./legal-links";
import Link from "next/link";

export function LegalPage({ title, sections }: { title: string; sections: LegalSection[] }) {
  return (
    <>
      <header className="mx-auto max-w-5xl px-4 py-4 md:px-6 lg:px-8">
        <Link href="/" className="inline-flex min-h-11 items-center text-lg font-semibold">
          Home
        </Link>
      </header>
      <main id="main" className="mx-auto max-w-5xl px-4 py-12 md:px-6 lg:px-8">
        <article className="max-w-prose">
          <h1 className="text-[32px] leading-[38px] md:text-5xl md:leading-[52px]">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">Last updated: {LEGAL_UPDATED}</p>
          <p
            role="note"
            className="mt-6 rounded-lg border border-notice-border bg-notice-bg p-4 text-notice-fg"
          >
            {LEGAL_BANNER}
          </p>
          {sections.map((s) => (
            <section key={s.heading} className="mt-8">
              <h2 className="text-2xl leading-8">{s.heading}</h2>
              {s.paragraphs.map((p) => (
                <p key={p} className="mt-3">
                  {p}
                </p>
              ))}
              {s.bullets && (
                <ul className="mt-3 list-disc space-y-2 pl-6">
                  {s.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
          <p className="mt-8 text-sm text-muted-foreground">Contact: {CONTACT_EMAIL}</p>
        </article>
      </main>
      <footer className="mx-auto max-w-5xl px-4 py-8 text-sm text-muted-foreground md:px-6 lg:px-8">
        <LegalLinks />
      </footer>
    </>
  );
}

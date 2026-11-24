import { BRAND } from "@app/core";
import { Info } from "lucide-react";
import Link from "next/link";
import { LegalLinks } from "../components/legal-links";
import { WaitlistForm } from "./waitlist-form";

const STEPS = [
  { title: "Add a subscription", text: "Enter the name, price and renewal date." },
  { title: "Set a stop date", text: "Pick the day you want payments to stop." },
  { title: "Get reminders", text: "We remind you 7, 3 and 1 days before." },
  { title: "Freeze the card yourself", text: "Freeze or close your card in your bank app." },
];

export default function Page() {
  return (
    <>
      <a
        href="#main"
        className="absolute -top-20 left-4 z-100 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:top-4"
      >
        Skip to main content
      </a>
      <header className="mx-auto max-w-5xl px-4 py-4 md:px-6 lg:px-8">
        <span className="text-lg font-semibold">{BRAND}</span>
      </header>
      <main id="main">
        <section className="mx-auto max-w-5xl px-4 py-12 md:px-6 md:py-24 lg:px-8">
          <h1 className="max-w-prose text-[32px] leading-[38px] md:text-5xl md:leading-[52px]">
            Know when to stop paying.
          </h1>
          <p className="mt-4 max-w-prose text-lg leading-7 text-muted-foreground">
            Payments stop on the date you set. {BRAND} reminds you to freeze or close your card a
            few days before renewal.
          </p>
          <div className="mt-8">
            <WaitlistForm />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            No bank linking. We never store card numbers.
          </p>
        </section>
        <section className="mx-auto max-w-5xl px-4 pb-12 md:px-6 md:pb-24 lg:px-8">
          <h2 className="text-2xl leading-8 md:text-[30px] md:leading-9">How it works</h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-lg border border-border bg-card p-6">
                <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
                  {i + 1}
                </span>
                <h3 className="mt-4 text-xl leading-7">{s.title}</h3>
                <p className="mt-2 text-muted-foreground">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>
        <section className="mx-auto max-w-5xl px-4 pb-12 md:px-6 md:pb-24 lg:px-8">
          <aside className="max-w-prose rounded-lg border-l-4 border-notice-border bg-notice-bg p-6 text-notice-fg">
            <h2 className="flex items-center gap-2 text-2xl leading-8">
              <Info className="size-6 shrink-0" aria-hidden="true" />
              Please read this
            </h2>
            <p className="mt-3">
              Freezing a card does not cancel a subscription. The merchant may still try to charge
              you and may treat a declined payment as unpaid debt. Always cancel with the merchant
              too.
            </p>
          </aside>
        </section>
      </main>
      <footer className="mx-auto max-w-5xl px-4 py-8 text-sm text-muted-foreground md:px-6 lg:px-8">
        {BRAND}
        {" · "}
        <Link href="/guides" className="inline-flex min-h-11 items-center underline">
          Cancel guides
        </Link>
        {" · "}
        <LegalLinks />
      </footer>
    </>
  );
}

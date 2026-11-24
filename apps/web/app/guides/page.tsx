import type { Metadata } from "next";
import Link from "next/link";
import { BRAND, type GuideKind } from "@app/core";
import { KIND_LABEL, loadGuides, siteBase } from "../../lib/guides";
import { Shell } from "./shell";

export const revalidate = 3600;

export const metadata: Metadata = {
  metadataBase: siteBase(),
  title: `Cancel guides | ${BRAND}`,
  description: "Step-by-step guides to cancel a subscription with the merchant.",
  alternates: { canonical: "/guides" },
};

const ORDER: GuideKind[] = ["cancel", "store", "provider"];

export default async function Page() {
  const guides = await loadGuides();
  return (
    <Shell>
      <h1 className="max-w-prose text-[32px] leading-[38px] md:text-5xl md:leading-[52px]">
        Cancel guides
      </h1>
      <p className="mt-4 max-w-prose text-lg leading-7 text-muted-foreground">
        Freezing or closing a card does not cancel a subscription. Cancel with the merchant first.
      </p>
      {ORDER.map((kind) => {
        const items = guides.filter((g) => g.kind === kind);
        if (items.length === 0) return null;
        return (
          <section key={kind} className="mt-10">
            <h2 className="text-2xl leading-8 md:text-[30px] md:leading-9">{KIND_LABEL[kind]}</h2>
            <ul className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {items.map((g) => (
                <li key={g.service_slug}>
                  <Link
                    href={`/guides/${g.kind}/${g.service_slug}`}
                    className="flex min-h-11 items-center rounded-lg border border-border bg-card p-4 text-xl leading-7 font-semibold"
                  >
                    {g.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </Shell>
  );
}

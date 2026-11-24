import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BRAND, guideKindSchema, guideSlugSchema } from "@app/core";
import { loadGuide, loadGuides, siteBase } from "../../../../lib/guides";
import { GuideView } from "../../guide-view";
import { Shell } from "../../shell";

export const revalidate = 3600;

type Props = { params: Promise<{ kind: string; slug: string }> };

async function find({ params }: Props) {
  const p = await params;
  const kind = guideKindSchema.safeParse(p.kind);
  if (!kind.success || !guideSlugSchema.safeParse(p.slug).success) return null;
  return loadGuide(kind.data, p.slug);
}

export async function generateStaticParams() {
  return (await loadGuides()).map((g) => ({ kind: g.kind, slug: g.service_slug }));
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const g = await find(props);
  if (!g) return { title: `Guide not found | ${BRAND}` };
  return {
    metadataBase: siteBase(),
    title: `How to cancel ${g.title} | ${BRAND}`,
    description: (g.steps[0]?.text ?? "").slice(0, 160),
    alternates: { canonical: `/guides/${g.kind}/${g.service_slug}` },
  };
}

export default async function Page(props: Props) {
  const guide = await find(props);
  if (!guide) notFound();
  return (
    <Shell>
      <GuideView guide={guide} todayIso={new Date().toISOString().slice(0, 10)} />
    </Shell>
  );
}

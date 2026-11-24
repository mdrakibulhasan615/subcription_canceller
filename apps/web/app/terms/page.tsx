import type { Metadata } from "next";
import { LegalPage } from "../../components/legal-page";
import { TERMS } from "../../lib/legal";

export const metadata: Metadata = { title: "Terms" };

export default function Page() {
  return <LegalPage title="Terms" sections={TERMS} />;
}

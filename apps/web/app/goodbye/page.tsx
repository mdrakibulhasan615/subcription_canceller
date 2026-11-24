import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Account deleted" };

export default function GoodbyePage() {
  return (
    <main id="main" className="mx-auto max-w-5xl px-4 py-12 md:px-6 lg:px-8">
      <h1 className="text-[32px] leading-[38px] md:text-5xl md:leading-[52px]">Goodbye</h1>
      <p className="mt-4 max-w-prose text-lg">Your account is deleted. We signed you out.</p>
      <p className="mt-4 flex gap-4">
        <Link href="/" className="inline-flex min-h-11 items-center underline">
          Home
        </Link>
        <Link href="/privacy" className="inline-flex min-h-11 items-center underline">
          Privacy
        </Link>
      </p>
    </main>
  );
}

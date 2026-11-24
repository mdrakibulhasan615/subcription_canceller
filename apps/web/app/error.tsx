"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { CONTACT_EMAIL } from "../lib/legal";

export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  const digest =
    typeof error === "object" && error !== null && "digest" in error
      ? String((error as { digest: unknown }).digest)
      : undefined;
  return (
    <main id="main" className="mx-auto max-w-5xl px-4 py-12 md:px-6 lg:px-8">
      <div className="max-w-prose">
        <h1 className="text-[32px] leading-[38px] md:text-5xl md:leading-[52px]">
          Something went wrong.
        </h1>
        <p className="mt-4">
          We could not finish that. Your data is safe. Try again. If it keeps happening, email{" "}
          {CONTACT_EMAIL}.
        </p>
        {digest && <p className="mt-2 text-sm text-muted-foreground">Reference: {digest}</p>}
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => retry()}
            className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 font-medium text-primary-foreground"
          >
            Try again
          </button>
          <Link href="/" className="inline-flex min-h-11 items-center underline">
            Go to home page
          </Link>
        </div>
      </div>
    </main>
  );
}

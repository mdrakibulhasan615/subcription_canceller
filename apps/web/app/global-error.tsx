"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { CONTACT_EMAIL } from "../lib/legal";

// Replaces the root layout, so it has no global CSS: inline styles only.
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  const digest =
    typeof error === "object" && error !== null && "digest" in error
      ? String((error as { digest: unknown }).digest)
      : undefined;
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          color: "#0F172A",
          background: "#FFFFFF",
          margin: 0,
          padding: "48px 16px",
        }}
      >
        <main style={{ maxWidth: "65ch", margin: "0 auto" }}>
          <title>Something went wrong</title>
          <h1 style={{ fontSize: 32, lineHeight: "38px" }}>Something went wrong.</h1>
          <p>
            We could not finish that. Your data is safe. Try again. If it keeps happening, email{" "}
            {CONTACT_EMAIL}.
          </p>
          {digest && <p style={{ fontSize: 14, color: "#475569" }}>Reference: {digest}</p>}
          <button
            type="button"
            onClick={() => retry()}
            style={{
              minHeight: 44,
              padding: "0 16px",
              marginRight: 16,
              border: 0,
              borderRadius: 8,
              background: "#0F766E",
              color: "#FFFFFF",
              fontSize: 16,
              fontWeight: 500,
            }}
          >
            Try again
          </button>
          {/* A plain anchor reloads the page: the app shell may be broken. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              minHeight: 44,
              color: "#0F172A",
            }}
          >
            Go to home page
          </a>
        </main>
      </body>
    </html>
  );
}

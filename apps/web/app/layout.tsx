import type { ReactNode } from "react";
import type { Metadata } from "next";
import { BRAND } from "@app/core";
import "./globals.css";

export const metadata: Metadata = {
  title: `${BRAND}: know when to stop paying`,
  description: `${BRAND} reminds you to freeze or close your card a few days before a subscription renews. No bank linking.`,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

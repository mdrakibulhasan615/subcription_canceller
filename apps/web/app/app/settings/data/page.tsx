import Link from "next/link";
import { DeleteForm } from "./delete-form";
import { deleteAccountAction } from "./actions";

export const metadata = { title: "Your data" };

const link =
  "inline-flex h-11 items-center justify-center rounded-md border border-input bg-background px-4 font-medium text-foreground hover:bg-accent";

export default function DataPage() {
  return (
    <>
      <h1 className="text-[32px] leading-[38px] md:text-5xl md:leading-[52px]">Your data</h1>
      <section className="mt-8 max-w-prose" aria-labelledby="export-h">
        <h2 id="export-h" className="text-2xl leading-8">
          Download your data
        </h2>
        <p className="mt-3">
          Download a copy of the data we hold about you. JSON has everything. CSV has your
          subscriptions only (opens in Excel and Sheets). We do not include anonymous usage events
          or other people&apos;s data.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Not in the file: anonymous usage events (we cannot list them for you), guide reports (not
          linked to you), your waitlist entry, and push keys (secrets; we export the endpoint only).
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a href="/api/export/json" download className={link}>
            Download JSON
          </a>
          <a href="/api/export/csv" download className={link}>
            Download CSV
          </a>
        </div>
      </section>
      <section className="mt-12 max-w-prose" aria-labelledby="delete-h">
        <h2 id="delete-h" className="text-2xl leading-8">
          Delete your account
        </h2>
        <p className="mt-3">
          This deletes your account, subscriptions, reminders and feedback now. It cannot be undone.
          Download your data first. If you joined our waitlist with this email, we delete that too.
          Some copies remain outside our database: error reports (Sentry) and email logs (Resend)
          keep data for a short time under their own rules. A reminder email already being sent may
          still arrive.
        </p>
        <p className="mt-3">
          <Link href="/privacy" className="inline-flex min-h-11 items-center underline">
            Read the privacy page
          </Link>
        </p>
        <DeleteForm action={deleteAccountAction} />
      </section>
    </>
  );
}

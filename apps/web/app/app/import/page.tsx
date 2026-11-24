import { Download } from "lucide-react";
import { createClient, getClaims } from "../../../lib/supabase/server";
import { templateCsv } from "../../../lib/csv-import";
import { createSubDb, todayIn, userIdFrom } from "../../../lib/subscriptions";
import { importAction } from "./actions";
import { ImportForm } from "./import-form";

export const metadata = { title: "Import from CSV" };

export default async function ImportPage() {
  const userId = userIdFrom(await getClaims());
  const profile = userId
    ? await createSubDb(await createClient())
        .getProfile(userId)
        .catch(() => null)
    : null;
  const template = `data:text/csv;charset=utf-8,${encodeURIComponent(
    "\uFEFF" + templateCsv(todayIn(profile?.timezone ?? "UTC", new Date())),
  )}`;
  return (
    <>
      <h1 className="text-[32px] leading-[38px] md:text-5xl md:leading-[52px]">Import from CSV</h1>
      <div className="mt-6 flex max-w-prose flex-col gap-3 text-muted-foreground">
        <p>
          Never put card numbers in the file. We use the file only to import it. We do not keep it.
          Importing does not contact any service.
        </p>
        <p>
          Required columns: name, price, billing_cycle, next_renewal_date. Optional: currency,
          billing_interval, stop_date, category, cancel_url, payment_method_type, card_nickname,
          notes. Dates use YYYY-MM-DD. Prices are plain numbers like 9.99, with no currency sign.
          Free-trial fields are not part of the import.
        </p>
        <a
          href={template}
          download="stopdate-template.csv"
          className="inline-flex min-h-11 w-fit items-center gap-2 rounded-md border border-input px-3 text-sm font-medium text-foreground"
        >
          <Download className="size-4" aria-hidden="true" />
          Download template
        </a>
      </div>
      {profile ? (
        <ImportForm action={importAction} />
      ) : (
        <p className="mt-8 text-destructive">
          Your settings could not be loaded. Reload the page to try again.
        </p>
      )}
    </>
  );
}

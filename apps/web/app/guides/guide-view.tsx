import { Clock, Info } from "lucide-react";
import { isGuideStale, type Guide } from "@app/core";
import { ReportButton } from "./report-button";

const fmt = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

const linkCls = "inline-flex min-h-11 items-center underline underline-offset-2";

export function GuideView({ guide, todayIso }: { guide: Guide; todayIso: string }) {
  const stale = isGuideStale(guide.last_checked_at, todayIso);
  return (
    <>
      <h1 className="max-w-prose text-[32px] leading-[38px] md:text-5xl md:leading-[52px]">
        How to cancel {guide.title}
      </h1>
      <p className="mt-4 flex flex-wrap items-center gap-3 text-sm tabular-nums text-muted-foreground">
        <span>
          {guide.last_checked_at ? `Last checked ${fmt(guide.last_checked_at)}` : "Not checked yet"}
        </span>
        {stale && (
          <span className="inline-flex min-h-6 items-center gap-1 rounded-sm bg-status-soon-bg px-2 text-xs font-semibold text-status-soon-fg">
            <Clock className="size-3.5 shrink-0" aria-hidden="true" />
            May be out of date
          </span>
        )}
      </p>
      <aside className="mt-6 max-w-prose rounded-lg border-l-4 border-notice-border bg-notice-bg p-4 text-notice-fg">
        <p className="flex items-start gap-2">
          <Info className="mt-1 size-4 shrink-0" aria-hidden="true" />
          Freezing or closing a card does not cancel a subscription. Cancel with the merchant first.
          Payments stop on the date you set.
        </p>
      </aside>
      <section className="mt-8">
        <h2 className="text-2xl leading-8">Steps</h2>
        <ol className="mt-4 max-w-prose list-decimal space-y-4 pl-6">
          {guide.steps.map((s, i) => (
            <li key={i}>
              {s.text}
              {s.link && (
                <>
                  {" "}
                  <a href={s.link} target="_blank" rel="noopener noreferrer" className={linkCls}>
                    Open link
                  </a>
                </>
              )}
              {s.note && <p className="mt-1 text-sm text-muted-foreground">{s.note}</p>}
            </li>
          ))}
        </ol>
      </section>
      <section className="mt-8">
        <h2 className="text-2xl leading-8">Links</h2>
        <ul className="mt-2 max-w-prose">
          {guide.url && (
            <li>
              <a href={guide.url} target="_blank" rel="noopener noreferrer" className={linkCls}>
                Official page
              </a>
            </li>
          )}
          {guide.contact_phone && (
            <li>
              <a href={`tel:${guide.contact_phone.replace(/[^\d+]/g, "")}`} className={linkCls}>
                Phone: {guide.contact_phone}
              </a>
            </li>
          )}
          {guide.contact_email && (
            <li>
              <a href={`mailto:${guide.contact_email}`} className={linkCls}>
                Email: {guide.contact_email}
              </a>
            </li>
          )}
          {guide.source_url && (
            <li>
              <a
                href={guide.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className={linkCls}
              >
                Source
              </a>
            </li>
          )}
        </ul>
      </section>
      <section className="mt-8">
        <h2 className="text-2xl leading-8">Something wrong?</h2>
        <ReportButton kind={guide.kind} slug={guide.service_slug} />
      </section>
    </>
  );
}

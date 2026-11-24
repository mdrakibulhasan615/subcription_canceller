import Link from "next/link";

const cls = "inline-flex min-h-11 items-center underline";

export function LegalLinks() {
  return (
    <>
      <Link href="/privacy" className={cls}>
        Privacy
      </Link>
      {" · "}
      <Link href="/terms" className={cls}>
        Terms
      </Link>
    </>
  );
}

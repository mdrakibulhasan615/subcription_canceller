import { LegalLinks } from "../../components/legal-links";
import { safeNext } from "../../lib/auth-routes";
import { SignInForm } from "./sign-in-form";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  return (
    <>
      <SignInForm next={safeNext(next)} callbackError={error === "callback"} />
      <footer className="mx-auto max-w-5xl px-4 py-8 text-sm text-muted-foreground md:px-6 lg:px-8">
        <LegalLinks />
      </footer>
    </>
  );
}

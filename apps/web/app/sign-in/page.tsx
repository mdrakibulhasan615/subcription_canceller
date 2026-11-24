import { safeNext } from "../../lib/auth-routes";
import { SignInForm } from "./sign-in-form";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  return <SignInForm next={safeNext(next)} callbackError={error === "callback"} />;
}

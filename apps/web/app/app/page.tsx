import { getClaims } from "../../lib/supabase/server";

export default async function AppHome() {
  const claims = await getClaims();
  return (
    <>
      <h1 className="text-[32px] leading-[38px] md:text-5xl md:leading-[52px]">
        You are signed in
      </h1>
      <p className="mt-4 text-lg break-all text-muted-foreground">
        {typeof claims?.email === "string" ? claims.email : ""}
      </p>
    </>
  );
}

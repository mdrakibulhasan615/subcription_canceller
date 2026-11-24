"use server";

import { redirect } from "next/navigation";
import { deleteAccount, type DeleteResult } from "../../../../lib/account";
import { rateLimit } from "../../../../lib/rate-limit";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { createClient, getClaims } from "../../../../lib/supabase/server";

export type DeleteState = { status: "idle" } | Extract<DeleteResult, { status: "error" }>;

const text = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v : "";
};

export async function deleteAccountAction(_prev: DeleteState, fd: FormData): Promise<DeleteState> {
  const claims = await getClaims();
  const user =
    claims && typeof claims.sub === "string"
      ? {
          id: claims.sub,
          email: typeof claims.email === "string" ? claims.email : null,
          iat: typeof claims.iat === "number" ? claims.iat : undefined,
        }
      : null;

  let result: DeleteResult;
  try {
    // Lazy: a missing key throws inside deleteAccount (server error, nothing deleted).
    let client: ReturnType<typeof createAdminClient> | undefined;
    const admin = () => (client ??= createAdminClient());
    result = await deleteAccount(
      {
        getUser: () => user,
        admin: {
          deleteWaitlistByEmail: async (email) => {
            // ilike with escaped wildcards = case-insensitive exact match.
            const exact = email.replace(/[\\%_]/g, "\\$&");
            return admin().from("waitlist").delete().ilike("email", exact);
          },
          deleteUser: async (id) => admin().auth.admin.deleteUser(id),
        },
        signOut: async () => (await createClient()).auth.signOut(),
        rateLimit,
      },
      { confirm: text(fd, "confirm"), email: text(fd, "email") },
    );
  } catch {
    result = {
      status: "error",
      code: "server",
      message: "Something went wrong. Your account may not be deleted. Try again.",
    };
  }
  if (result.status === "ok") redirect("/goodbye");
  return result;
}

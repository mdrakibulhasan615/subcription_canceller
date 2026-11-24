export const ANSWERS = ["yes", "maybe", "no"] as const;
export type Answer = (typeof ANSWERS)[number];
export const FEEDBACK_KEY = "auto_close_interest";

export const isAnswer = (v: unknown): v is Answer => (ANSWERS as readonly unknown[]).includes(v);

type Err = { code?: string } | null;
export type FeedbackDb = {
  from: (table: "feedback") => {
    insert: (row: { user_id: string; key: string; value: string }) => PromiseLike<{ error: Err }>;
    select: (cols: "id") => {
      eq: (
        col: string,
        v: string,
      ) => {
        eq: (
          col: string,
          v: string,
        ) => {
          limit: (n: number) => PromiseLike<{ data: unknown[] | null; error: Err }>;
        };
      };
    };
  };
};

/** A duplicate (23505) means the user already answered, so it counts as saved. */
export async function saveInterest(db: FeedbackDb, userId: string, answer: Answer): Promise<void> {
  const { error } = await db
    .from("feedback")
    .insert({ user_id: userId, key: FEEDBACK_KEY, value: answer });
  if (error && error.code !== "23505") throw new Error("feedback insert failed");
}

/** Throws when the read fails. The caller then shows no card. */
export async function hasAnswered(db: FeedbackDb, userId: string): Promise<boolean> {
  const { data, error } = await db
    .from("feedback")
    .select("id")
    .eq("user_id", userId)
    .eq("key", FEEDBACK_KEY)
    .limit(1);
  if (error) throw new Error("feedback read failed");
  return (data?.length ?? 0) > 0;
}

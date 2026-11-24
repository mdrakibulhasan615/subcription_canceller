import { describe, expect, it, vi } from "vitest";
import { hasAnswered, isAnswer, saveInterest, type FeedbackDb } from "./card-interest";

const insertDb = (error: { code?: string } | null) => {
  const insert = vi.fn(async () => ({ error }));
  return { insert, db: { from: () => ({ insert }) } as unknown as FeedbackDb };
};
const readDb = (r: { data: unknown[] | null; error: { code?: string } | null }) =>
  ({
    from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ limit: async () => r }) }) }) }),
  }) as unknown as FeedbackDb;

describe("card interest", () => {
  it("validates answers", () => {
    expect(["yes", "maybe", "no"].every(isAnswer)).toBe(true);
    expect(isAnswer("YES")).toBe(false);
    expect(isAnswer(null)).toBe(false);
  });

  it("saves one feedback row", async () => {
    const t = insertDb(null);
    await saveInterest(t.db, "u1", "yes");
    expect(t.insert).toHaveBeenCalledWith({
      user_id: "u1",
      key: "auto_close_interest",
      value: "yes",
    });
  });

  it("treats a duplicate as saved and throws on other errors", async () => {
    await expect(saveInterest(insertDb({ code: "23505" }).db, "u", "no")).resolves.toBeUndefined();
    await expect(saveInterest(insertDb({ code: "42501" }).db, "u", "no")).rejects.toThrow();
  });

  it("hasAnswered reads the row count", async () => {
    expect(await hasAnswered(readDb({ data: [{ id: "x" }], error: null }), "u")).toBe(true);
    expect(await hasAnswered(readDb({ data: [], error: null }), "u")).toBe(false);
    await expect(hasAnswered(readDb({ data: null, error: {} }), "u")).rejects.toThrow();
  });
});

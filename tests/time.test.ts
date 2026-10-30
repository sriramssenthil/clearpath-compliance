import { describe, expect, it } from "vitest";
import { relativeTime } from "@/lib/time";

describe("relativeTime", () => {
  const now = new Date("2026-10-30T18:49:00Z");
  it("truncates instead of rounding, so every page agrees (QA: 3 days 22 hours showed as 3 and 4 days)", () => {
    expect(relativeTime(new Date("2026-10-26T20:49:00Z"), now)).toBe("3 days ago");
  });
  it("handles recent, future and long spans", () => {
    expect(relativeTime(new Date(now.getTime() - 20_000), now)).toBe("just now");
    expect(relativeTime(new Date(now.getTime() - 90 * 60_000), now)).toBe("1 hour ago");
    expect(relativeTime(new Date(now.getTime() + 5 * 3_600_000 + 50 * 60_000), now)).toBe("in 5 hours");
    expect(relativeTime(new Date(now.getTime() - 86_400_000 - 1000), now)).toBe("yesterday");
  });
});

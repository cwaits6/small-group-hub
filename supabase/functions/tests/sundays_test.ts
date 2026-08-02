// Locks the Sunday math the serving reminder schedule is keyed on. All cases
// pass an explicit `from` so the tests are deterministic.

import { assertEquals } from "jsr:@std/assert@1";
import { nextSunday, upcomingSundays } from "../_shared/sundays.ts";

Deno.test("nextSunday from a weekday returns the following Sunday", () => {
  // 2026-08-05 is a Wednesday
  assertEquals(nextSunday(new Date(2026, 7, 5)), "2026-08-09");
});

Deno.test("nextSunday from a Sunday returns that same Sunday", () => {
  // 2026-08-09 is a Sunday
  assertEquals(nextSunday(new Date(2026, 7, 9)), "2026-08-09");
});

Deno.test("nextSunday crosses month and year boundaries", () => {
  // 2026-12-30 is a Wednesday; next Sunday is Jan 3, 2027
  assertEquals(nextSunday(new Date(2026, 11, 30)), "2027-01-03");
});

Deno.test("nextSunday ignores the time-of-day component", () => {
  assertEquals(nextSunday(new Date(2026, 7, 5, 23, 59, 59)), "2026-08-09");
});

Deno.test("upcomingSundays returns consecutive Sundays starting at nextSunday", () => {
  assertEquals(upcomingSundays(4, new Date(2026, 7, 5)), [
    "2026-08-09",
    "2026-08-16",
    "2026-08-23",
    "2026-08-30",
  ]);
});

Deno.test("upcomingSundays with zero weeks returns an empty list", () => {
  assertEquals(upcomingSundays(0, new Date(2026, 7, 5)), []);
});

import type { AssetContext } from "./types";

const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado",
  CT: "Connecticut", DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas",
  KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts",
  MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
  NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico",
  NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma",
  OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota",
  TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington",
  WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

/**
 * A rule scoped by `statesAny` applies when ctx.states includes one of those states. An
 * empty ctx.states means a nationwide asset, which reaches every state, so we then apply
 * the rule only if the copy itself names the state: the full name (any case) or the
 * two-letter code as an UPPERCASE standalone token (case-sensitive, so "in", "or", "me"
 * and "ok" do not count). This avoids demanding a California license statement from
 * every national ad while still catching "Available in CA".
 */
function mentionsState(content: string, code: string): boolean {
  const name = STATE_NAMES[code];
  if (name && new RegExp(`(?<![\\p{L}\\p{N}])${name}(?![\\p{L}\\p{N}])`, "iu").test(content)) return true;
  // A code followed by a ZIP ("San Francisco, CA 94111") is a postal address, not a targeting claim.
  return new RegExp(`(?<![\\p{L}\\p{N}])${code}(?![\\p{L}\\p{N}])(?!\\s*\\d{5})`, "u").test(content);
}

export function stateApplies(ctx: AssetContext, statesAny: string[] | undefined): boolean {
  if (!statesAny || statesAny.length === 0) return true;
  const wanted = statesAny.map((s) => String(s).toUpperCase());
  if (ctx.states.length > 0) return ctx.states.some((s) => wanted.includes(String(s).toUpperCase()));
  return wanted.some((s) => mentionsState(ctx.content, s));
}

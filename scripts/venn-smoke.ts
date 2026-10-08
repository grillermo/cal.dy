import process from "node:process";
import { getAdapter } from "../packages/features/venn/adapters/getAdapter";
import type { AvailabilityAdapter } from "../packages/features/venn/adapters/types";
import { parseBookingUrl } from "../packages/features/venn/links/parseBookingUrl";

// LOCAL links are rejected before an adapter is requested, so this is never called.
const unusedLocalAdapter: AvailabilityAdapter = {
  fetchAvailability: async () => {
    throw new Error("The smoke script does not cover local links");
  },
};

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error("usage: yarn venn:smoke <booking-url>");
    process.exit(2);
  }
  const parsed = parseBookingUrl(url, "localhost");
  if (!parsed) {
    console.error(`Unsupported link: ${url}`);
    process.exit(2);
  }
  if (parsed.provider === "LOCAL") {
    console.error("Smoke script covers Calendly and cal.com only");
    process.exit(2);
  }
  const start = new Date();
  const end = new Date(start.getTime() + 14 * 24 * 60 * 60 * 1000);
  const result = await getAdapter(parsed.provider, { localAdapter: unusedLocalAdapter }).fetchAvailability({
    url: parsed.normalizedUrl,
    start,
    end,
  });
  console.log(
    `provider=${parsed.provider} duration=${result.durationMinutes}m intervals=${result.freeIntervals.length}`
  );
  console.log(
    result.freeIntervals
      .slice(0, 3)
      .map((i) => `${i.start.toISOString()} -> ${i.end.toISOString()}`)
      .join("\n")
  );
  if (result.freeIntervals.length === 0) {
    console.warn(
      "No availability returned. If the page shows openings, the provider API shape may have changed."
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

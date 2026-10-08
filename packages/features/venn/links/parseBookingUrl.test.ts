import { describe, expect, it } from "vitest";
import { parseBookingUrl } from "./parseBookingUrl";

const LOCAL = "cal.example.com";

describe("parseBookingUrl", () => {
  it("parses a Calendly link and ignores query string and trailing slash", () => {
    expect(parseBookingUrl("https://calendly.com/ana/60min/?month=2026-10", LOCAL)).toEqual({
      provider: "CALENDLY",
      profile: "ana",
      eventSlug: "60min",
      normalizedUrl: "https://calendly.com/ana/60min",
    });
  });

  it("parses a hosted cal.com link", () => {
    expect(parseBookingUrl("https://cal.com/bob/30min", LOCAL)?.provider).toBe("CALCOM");
  });

  it("parses a link on this instance as LOCAL", () => {
    expect(parseBookingUrl("https://cal.example.com/me/intro", LOCAL)).toMatchObject({
      provider: "LOCAL",
      profile: "me",
      eventSlug: "intro",
    });
  });

  it("matches a LOCAL host that includes a port", () => {
    expect(parseBookingUrl("http://localhost:3000/me/intro", "localhost:3000")).toMatchObject({
      provider: "LOCAL",
      profile: "me",
      eventSlug: "intro",
      normalizedUrl: "http://localhost:3000/me/intro",
    });
  });

  it("treats host case-insensitively and strips www", () => {
    expect(parseBookingUrl("https://WWW.Calendly.com/Ana/60min", LOCAL)?.normalizedUrl).toBe(
      "https://calendly.com/ana/60min"
    );
  });

  it.each([
    "https://cal.com/team/acme/standup",
    "https://calendly.com/ana",
    "https://calendly.com/d/abc-123/meeting",
    "https://example.org/ana/30min",
    "not a url",
    "",
  ])("rejects unsupported link %s", (url) => {
    expect(parseBookingUrl(url, LOCAL)).toBeNull();
  });
});

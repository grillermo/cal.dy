import type { ParsedBookingUrl, VennProviderKind } from "../types";

const stripWww = (host: string) => host.replace(/^www\./, "");

// The local instance may be configured with a port (e.g. localhost:3000), so LOCAL also matches on host:port.
function providerForHost(host: string, hostWithPort: string, localHost: string): VennProviderKind | null {
  if (host === "calendly.com") return "CALENDLY";
  if (host === "cal.com") return "CALCOM";
  const local = stripWww(localHost.toLowerCase());
  if (host === local || hostWithPort === local) return "LOCAL";
  return null;
}

export function parseBookingUrl(rawUrl: string, localHost: string): ParsedBookingUrl | null {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const host = stripWww(url.hostname.toLowerCase());
  const hostWithPort = stripWww(url.host.toLowerCase());
  const provider = providerForHost(host, hostWithPort, localHost);
  if (!provider) return null;

  const segments = url.pathname
    .split("/")
    .filter(Boolean)
    .map((s) => s.toLowerCase());
  if (segments.length !== 2) return null;

  const [profile, eventSlug] = segments;
  // "team" and "d" are cal.com team and Calendly shared-link prefixes, which v1 does not support.
  if ((provider === "CALCOM" && profile === "team") || (provider === "CALENDLY" && profile === "d")) {
    return null;
  }

  const origin = provider === "LOCAL" ? `${url.protocol}//${url.host}` : `https://${host}`;
  return { provider, profile, eventSlug, normalizedUrl: `${origin}/${profile}/${eventSlug}` };
}

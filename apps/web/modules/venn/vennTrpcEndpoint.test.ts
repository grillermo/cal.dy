import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { ENDPOINTS } from "@calcom/trpc/react/shared";
import { describe, expect, it } from "vitest";

// The tRPC client routes `viewer.venn.*` to `/api/trpc/<2nd path segment>`, so the venn UI only works
// when "venn" is a known endpoint and a Pages-Router handler serves that segment.
const ROUTE_FILE: string = path.resolve(__dirname, "../../pages/api/trpc/venn/[trpc].ts");

describe("venn tRPC endpoint", () => {
  it("is registered in ENDPOINTS", () => {
    expect(ENDPOINTS).toContain("venn");
  });

  it("has a Pages-Router handler serving the venn router", () => {
    expect(existsSync(ROUTE_FILE)).toBe(true);
    const source = readFileSync(ROUTE_FILE, "utf8");
    expect(source).toContain("createNextApiHandler(vennRouter)");
    expect(source).toContain("@calcom/trpc/server/routers/viewer/venn/_router");
  });
});

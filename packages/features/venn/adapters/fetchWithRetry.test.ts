import { describe, expect, it, vi } from "vitest";
import { fetchWithRetry } from "./fetchWithRetry";

const ok = () => new Response("{}", { status: 200 });
const sleep = vi.fn(async () => {});

describe("fetchWithRetry", () => {
  it("retries 5xx with 1s, 2s backoff and then succeeds", async () => {
    sleep.mockClear();
    const f = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(new Response("", { status: 429 }))
      .mockResolvedValueOnce(ok());
    const res = await fetchWithRetry(f as unknown as typeof fetch, "https://x", {}, { sleep });
    expect(res.status).toBe(200);
    expect(f).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([1000, 2000]);
  });

  it("does not retry a 404", async () => {
    const f = vi.fn().mockResolvedValue(new Response("", { status: 404 }));
    const res = await fetchWithRetry(f as unknown as typeof fetch, "https://x", {}, { sleep });
    expect(res.status).toBe(404);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("throws after 3 failed attempts", async () => {
    const f = vi.fn().mockRejectedValue(new Error("network"));
    await expect(fetchWithRetry(f as unknown as typeof fetch, "https://x", {}, { sleep })).rejects.toThrow(
      "network"
    );
    expect(f).toHaveBeenCalledTimes(3);
  });

  it("aborts a request that exceeds the timeout", async () => {
    const f = vi.fn((_: string, init: RequestInit) => {
      return new Promise<Response>((_res, rej) => {
        init.signal?.addEventListener("abort", () => rej(new Error("aborted")));
      });
    });
    await expect(
      fetchWithRetry(f as unknown as typeof fetch, "https://x", {}, { attempts: 1, timeoutMs: 10, sleep })
    ).rejects.toThrow("aborted");
  });

  it("aborts and retries when the response body never arrives", async () => {
    const f = vi.fn(async () => {
      const body = new ReadableStream({ start() {} });
      return new Response(body, { status: 200 });
    });
    await expect(
      fetchWithRetry(f as unknown as typeof fetch, "https://x", {}, { attempts: 2, timeoutMs: 20, sleep })
    ).rejects.toThrow(/timed out/);
    expect(f).toHaveBeenCalledTimes(2);
  });
});

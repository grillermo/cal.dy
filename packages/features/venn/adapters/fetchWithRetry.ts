type Options = {
  attempts?: number;
  timeoutMs?: number;
  baseDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const isRetryable = (status: number) => status >= 500 || status === 429;

export async function fetchWithRetry(
  fetchFn: typeof fetch,
  input: string,
  init: RequestInit,
  { attempts = 3, timeoutMs = 10_000, baseDelayMs = 1000, sleep = defaultSleep }: Options = {}
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) await sleep(baseDelayMs * 2 ** (attempt - 1));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchFn(input, { ...init, signal: controller.signal });
      if (!isRetryable(res.status)) return res;
      lastError = new Error(`HTTP ${res.status} from ${input}`);
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

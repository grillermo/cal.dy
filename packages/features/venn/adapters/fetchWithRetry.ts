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
    let timer: ReturnType<typeof setTimeout> | undefined;
    // The timeout must cover reading the body too, so the body is buffered inside the timed section.
    const timedOut = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error(`Request to ${input} aborted: timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
    const request = (async () => {
      const res = await fetchFn(input, { ...init, signal: controller.signal });
      const text = await res.text();
      return new Response(text, { status: res.status, statusText: res.statusText, headers: res.headers });
    })();
    request.catch(() => {});
    try {
      const res = await Promise.race([request, timedOut]);
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

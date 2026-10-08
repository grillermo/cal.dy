import { ErrorWithCode } from "@calcom/lib/errors";
import { convertErrorWithCodeToTRPCError } from "../lib/toTRPCError";
import { middleware } from "../trpc";

/**
 * Middleware that converts ErrorWithCode failures to TRPCError.
 *
 * tRPC v11 does not throw out of `next()`: a failing resolver comes back as `{ ok: false, error }` with the
 * original error as `error.cause`, so the result has to be inspected rather than caught.
 */
export const errorConversionMiddleware = middleware(async ({ next }) => {
  let result: Awaited<ReturnType<typeof next>>;
  try {
    result = await next();
  } catch (e) {
    throw convertErrorWithCodeToTRPCError(e);
  }
  if (!result.ok && result.error.cause instanceof ErrorWithCode) {
    throw convertErrorWithCodeToTRPCError(result.error.cause);
  }
  return result;
});

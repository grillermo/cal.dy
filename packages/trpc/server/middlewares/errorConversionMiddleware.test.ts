import { ErrorCode } from "@calcom/lib/errorCodes";
import { ErrorWithCode } from "@calcom/lib/errors";
import { describe, expect, it } from "vitest";
import publicProcedure from "../procedures/publicProcedure";
import { createCallerFactory, procedure, router } from "../trpc";
import { errorConversionMiddleware } from "./errorConversionMiddleware";

const failWith = (error: unknown) => async () => {
  throw error;
};

const testRouter = router({
  base: procedure
    .use(errorConversionMiddleware)
    .query(failWith(new ErrorWithCode(ErrorCode.Forbidden, "nope"))),
  public: publicProcedure
    .use(errorConversionMiddleware)
    .query(failWith(new ErrorWithCode(ErrorCode.NotFound, "gone"))),
  plain: procedure.use(errorConversionMiddleware).query(failWith(new Error("boom"))),
  ok: procedure.use(errorConversionMiddleware).query(() => "fine"),
});
const caller = createCallerFactory(testRouter)({} as never);

const catchError = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (e) => e
  );

describe("errorConversionMiddleware", () => {
  it("converts an ErrorWithCode(Forbidden) thrown by the resolver to FORBIDDEN", async () => {
    const error = await catchError(caller.base());
    expect(error.code).toBe("FORBIDDEN");
    expect(error.message).toBe("nope");
    expect(error.cause).toBeInstanceOf(ErrorWithCode);
  });

  it("converts on the publicProcedure path too", async () => {
    const error = await catchError(caller.public());
    expect(error.code).toBe("NOT_FOUND");
  });

  it("passes non-ErrorWithCode errors through unchanged", async () => {
    const error = await catchError(caller.plain());
    expect(error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(error.cause).toBeInstanceOf(Error);
    expect(error.cause.message).toBe("boom");
  });

  it("returns successful results untouched", async () => {
    await expect(caller.ok()).resolves.toBe("fine");
  });
});

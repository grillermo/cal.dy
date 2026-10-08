import { ErrorWithCode } from "@calcom/lib/errors";
import type { TRPCError } from "@trpc/server";
import { z } from "zod";

type ErrorShape = {
  message: string;
  code: number;
  data: {
    code: string;
    httpStatus: number;
    path?: string;
    [key: string]: unknown;
  };
};

type ErrorFormatterOptions = {
  shape: ErrorShape;
  error: TRPCError;
  type: "query" | "mutation" | "subscription" | "unknown";
  path: string | undefined;
  input: unknown;
  ctx: unknown;
};

export function errorFormatter({ shape, error }: ErrorFormatterOptions): ErrorShape {
  if (error.cause instanceof z.ZodError) {
    return {
      message: "Invalid input",
      code: 400,
      data: {
        code: "BAD_REQUEST",
        httpStatus: 400,
        path: shape.data.path,
        zodError: error.cause.flatten(),
      },
    };
  }
  // The tRPC wire shape drops `cause`, so clients cannot otherwise tell domain errors apart.
  if (error.cause instanceof ErrorWithCode) {
    return { ...shape, data: { ...shape.data, errorCode: error.cause.code } };
  }
  return shape;
}

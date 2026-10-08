import { prisma } from "@calcom/prisma";
import type { PrismaClient } from "@calcom/prisma";
import { Prisma } from "@calcom/prisma/client";

import { isFinalAttempt } from "./isFinalAttempt";
import { type TaskTypes } from "./tasker";

const whereSucceeded: Prisma.TaskWhereInput = {
  succeededAt: { not: null },
};

const whereMaxAttemptsReached: Prisma.TaskWhereInput = {
  attempts: {
    equals: {
      // @ts-expect-error prisma is tripping: '_ref' does not exist in type 'FieldRef<"Task", "Int">'
      _ref: "maxAttempts",
      _container: "Task",
    },
  },
};

/** This is a function to ensure new Date is always fresh */
const makeWhereUpcomingTasks = (): Prisma.TaskWhereInput => ({
  // Get only tasks that have not succeeded yet
  succeededAt: null,
  // Get only tasks that are scheduled to run now or in the past
  scheduledAt: {
    lt: new Date(),
  },
  // Get only tasks where maxAttemps has not been reached
  attempts: {
    lt: {
      // @ts-expect-error prisma is tripping: '_ref' does not exist in type 'FieldRef<"Task", "Int">'
      _ref: "maxAttempts",
      _container: "Task",
    },
  },
});

type Dependencies = {
  prismaClient: PrismaClient;
};

export class TaskRepository {
  constructor(private readonly deps: Dependencies) {}

  async create(
    type: TaskTypes,
    payload: string,
    options: { scheduledAt?: Date; maxAttempts?: number; referenceUid?: string } = {}
  ) {
    const { scheduledAt, maxAttempts, referenceUid } = options;
    console.info("Creating task", { type, payload, scheduledAt, maxAttempts });
    const newTask = await this.deps.prismaClient.task.create({
      data: {
        payload,
        type,
        scheduledAt,
        maxAttempts,
        referenceUid,
      },
    });
    return newTask.id;
  }

  async getNextBatch() {
    console.info("Getting next batch of tasks", makeWhereUpcomingTasks());
    return this.deps.prismaClient.task.findMany({
      where: makeWhereUpcomingTasks(),
      orderBy: {
        scheduledAt: "asc",
      },
      take: 1000,
    });
  }

  async getFailed() {
    return this.deps.prismaClient.task.findMany({
      where: whereMaxAttemptsReached,
    });
  }

  async getSucceeded() {
    return this.deps.prismaClient.task.findMany({
      where: whereSucceeded,
    });
  }

  async count() {
    return this.deps.prismaClient.task.count();
  }

  async countUpcoming() {
    return this.deps.prismaClient.task.count({
      where: makeWhereUpcomingTasks(),
    });
  }

  async countFailed() {
    return this.deps.prismaClient.task.count({
      where: whereMaxAttemptsReached,
    });
  }

  async countSucceeded() {
    return this.deps.prismaClient.task.count({
      where: whereSucceeded,
    });
  }

  async retry({
    taskId,
    lastError,
    minRetryIntervalMins,
  }: {
    taskId: string;
    lastError?: string;
    minRetryIntervalMins?: number | null;
  }) {
    const failedAttemptTime = new Date();
    const updatedScheduledAt = minRetryIntervalMins
      ? new Date(failedAttemptTime.getTime() + 1000 * 60 * minRetryIntervalMins)
      : undefined;

    return this.deps.prismaClient.task.update({
      where: {
        id: taskId,
      },
      data: {
        attempts: { increment: 1 },
        lastError,
        lastFailedAttemptAt: failedAttemptTime,
        ...(updatedScheduledAt && {
          scheduledAt: updatedScheduledAt,
        }),
      },
    });
  }

  async isFinalAttempt(taskId?: string): Promise<boolean> {
    if (!taskId) return false;
    const task = await this.deps.prismaClient.task.findUnique({
      where: { id: taskId },
      select: { attempts: true, maxAttempts: true },
    });
    if (!task) return false;
    return isFinalAttempt(task.attempts, task.maxAttempts);
  }

  /**
   * Claims one task for an immediate run outside the cron processor.
   *
   * getNextBatch() never claims rows, so a task run outside the cron must be invisible to it. Such a task is
   * created with a future `scheduledAt` (`leasedUntil`), which getNextBatch skips. This compare-and-set update
   * succeeds for exactly one caller: it requires the row to still carry the original lease (a previous claim or a
   * retry() changes it) and the lease to be unexpired (once expired, the cron may already have selected the row).
   * Postgres re-checks the WHERE clause after a concurrent update commits, so two racing claims cannot both match.
   * Winning moves `scheduledAt` further out so the cron keeps skipping the row while the claimer runs it; a failed
   * run goes through retry(), which reschedules it for the cron.
   */
  async claimLeased({
    taskId,
    type,
    leasedUntil,
    extendByMs,
  }: {
    taskId: string;
    type: TaskTypes;
    leasedUntil: Date;
    extendByMs: number;
  }): Promise<{ id: string; type: string; payload: string } | null> {
    const { count } = await this.deps.prismaClient.task.updateMany({
      where: {
        id: taskId,
        type,
        succeededAt: null,
        scheduledAt: { equals: leasedUntil, gt: new Date() },
      },
      data: { scheduledAt: new Date(leasedUntil.getTime() + extendByMs) },
    });
    if (count !== 1) return null;
    return this.deps.prismaClient.task.findUnique({
      where: { id: taskId },
      select: { id: true, type: true, payload: true },
    });
  }

  async succeed(taskId: string) {
    return this.deps.prismaClient.task.update({
      where: {
        id: taskId,
      },
      data: {
        attempts: { increment: 1 },
        succeededAt: new Date(),
      },
    });
  }

  /**
   * Update the payload of a task
   *
   * @param taskId - The ID of the task to update
   * @param newPayload - The new payload string
   */
  async updatePayload(taskId: string, newPayload: string) {
    return this.deps.prismaClient.task.update({
      where: {
        id: taskId,
      },
      data: {
        payload: newPayload,
      },
    });
  }

  async cancel(taskId: string) {
    return this.deps.prismaClient.task.delete({
      where: {
        id: taskId,
      },
    });
  }

  async cancelWithReference(referenceUid: string, type: TaskTypes): Promise<{ id: string } | null> {
    // prismaClient.task.delete throws an error if the task does not exist, so we catch it and return null
    try {
      return await this.deps.prismaClient.task.delete({
        where: {
          referenceUid_type: {
            referenceUid,
            type,
          },
        },
        select: {
          id: true,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        // P2025 is the error code for "Record to delete does not exist"
        console.warn(`Task with reference ${referenceUid} and type ${type} does not exist. No action taken.`);
        return null;
      }
      throw error;
    }
  }

  async cleanup() {
    // TODO: Uncomment this later
    // return this.deps.prismaClient.task.deleteMany({
    //   where: {
    //     OR: [
    //       // Get tasks that have succeeded
    //       whereSucceeded,
    //       // Get tasks where maxAttemps has been reached
    //       whereMaxAttemptsReached,
    //     ],
    //   },
    // });
  }

}

// Export singleton instance for backward compatibility
// This allows existing code using Task.create(), Task.succeed(), etc. to continue working
export const Task = new TaskRepository({ prismaClient: prisma });

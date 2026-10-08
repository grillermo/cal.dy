import { Task, type TaskRepository } from "./repository";
import type { TaskTypes } from "./tasker";
import tasksMap, { tasksConfig } from "./tasks";

type TaskProcessorDeps = {
  taskRepository: Pick<TaskRepository, "getNextBatch" | "succeed" | "retry" | "claimLeased">;
  handlers: typeof tasksMap;
};

type RunnableTask = { id: string; type: string; payload: string };

/**
 * TaskProcessor handles the processing of tasks from the queue.
 * This is separated from task creation to avoid importing all task handlers
 * when only creating tasks, which eliminates compilation overhead.
 */
export class TaskProcessor {
  constructor(private readonly deps: TaskProcessorDeps = { taskRepository: Task, handlers: tasksMap }) {}

  async processQueue(): Promise<void> {
    const tasks = await this.deps.taskRepository.getNextBatch();
    console.info(`Processing ${tasks.length} tasks`, tasks);

    const tasksPromises = tasks.map(async (task) => {
      console.info(
        `Processing task ${task.id}, attempt:${task.attempts} maxAttempts:${task.maxAttempts} lastFailedAttempt:${task.lastFailedAttemptAt}`,
        task
      );
      return this.runTask(task);
    });
    const settled = await Promise.allSettled(tasksPromises);
    const failed = settled.filter((result) => result.status === "rejected");
    const succeded = settled.filter((result) => result.status === "fulfilled");
    console.info({ failed, succeded });
  }

  /**
   * Runs only the given tasks, each after winning TaskRepository.claimLeased, so a caller can start work it just
   * enqueued without draining (and possibly double-running) the shared queue that processQueue() serves.
   */
  async processLeasedTasks(
    type: TaskTypes,
    taskIds: string[],
    { leasedUntil, extendByMs }: { leasedUntil: Date; extendByMs: number }
  ): Promise<void> {
    await Promise.allSettled(
      taskIds.map(async (taskId) => {
        const task = await this.deps.taskRepository.claimLeased({ taskId, type, leasedUntil, extendByMs });
        if (!task) {
          console.info(`Task ${taskId} was not claimed (already claimed, done or lease expired)`);
          return;
        }
        await this.runTask(task);
      })
    );
  }

  private async runTask(task: RunnableTask): Promise<void> {
    const taskHandlerGetter = this.deps.handlers[task.type as keyof typeof tasksMap];
    if (!taskHandlerGetter) throw new Error(`Task handler not found for type ${task.type}`);
    const taskConfig = tasksConfig[task.type as keyof typeof tasksConfig];
    const taskHandler = await taskHandlerGetter();
    return taskHandler(task.payload, task.id)
      .then(async () => {
        await this.deps.taskRepository.succeed(task.id);
      })
      .catch(async (error) => {
        console.info(`Retrying task ${task.id}: ${error}`);
        await this.deps.taskRepository.retry({
          taskId: task.id,
          lastError: error instanceof Error ? error.message : "Unknown error",
          minRetryIntervalMins:
            taskConfig && "minRetryIntervalMins" in taskConfig ? taskConfig.minRetryIntervalMins : null,
        });
      });
  }
}

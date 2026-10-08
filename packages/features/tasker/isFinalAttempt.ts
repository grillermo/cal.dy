// TaskProcessor increments `attempts` only after the handler settles (Task.retry / Task.succeed),
// so while a handler runs, `attempts` counts the previous failures and the current run is attempt attempts + 1.
export function isFinalAttempt(attempts: number, maxAttempts: number): boolean {
  return attempts + 1 >= maxAttempts;
}

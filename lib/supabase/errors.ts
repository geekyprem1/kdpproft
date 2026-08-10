/** Safe, shared checks for Supabase mutations that must affect rows. */

interface SupabaseErrorLike {
  message: string;
  code?: string;
}

interface MutationResult<T> {
  data: T | null;
  error: SupabaseErrorLike | null;
}

export class PersistenceError extends Error {
  readonly cause?: unknown;

  constructor(operation: string, cause?: unknown) {
    super(`${operation} failed`);
    this.name = "PersistenceError";
    this.cause = cause;
  }
}

export class PersistenceNotFoundError extends PersistenceError {
  constructor(target: string) {
    super(target);
    this.name = "PersistenceNotFoundError";
    this.message = `${target} not found`;
  }
}

export function requireMutationRow<T>(
  result: MutationResult<T>,
  operation: string,
  target = "Record"
): T {
  if (result.error) throw new PersistenceError(operation, result.error);
  if (!result.data) throw new PersistenceNotFoundError(target);
  return result.data;
}

export function requireMutationRows<T>(
  result: MutationResult<T[]>,
  expectedCount: number,
  operation: string
): T[] {
  if (result.error) throw new PersistenceError(operation, result.error);
  if (!result.data || result.data.length !== expectedCount) {
    throw new PersistenceError(operation);
  }
  return result.data;
}

export function isPersistenceNotFound(error: unknown): error is PersistenceNotFoundError {
  return error instanceof PersistenceNotFoundError;
}

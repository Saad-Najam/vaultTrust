/**
 * Helpers for working with values caught in `catch` blocks.
 *
 * TypeScript types a caught value as `unknown`, because a `throw` can carry
 * anything — not just an `Error`. These narrow it safely so route handlers can
 * report a message without an `any` cast that would hide a genuine shape bug.
 */

/** Best-effort human-readable message for any thrown value. */
export function getErrorMessage(
  error: unknown,
  fallback = "Internal Server Error"
): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  // Some SDKs reject with a plain object carrying a `message` field.
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string" &&
    (error as { message: string }).message
  ) {
    return (error as { message: string }).message;
  }
  return fallback;
}

/** True when the error's message begins with a given sentinel prefix. */
export function errorStartsWith(error: unknown, prefix: string): boolean {
  return getErrorMessage(error, "").startsWith(prefix);
}

/** True when the error's message contains a given substring. */
export function errorIncludes(error: unknown, needle: string): boolean {
  return getErrorMessage(error, "").includes(needle);
}

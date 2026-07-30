import { getErrorMessage } from "@/lib/errors";
// Classifies failures from Solana RPC calls so callers can decide what's
// retryable, what's user-facing-safe to retry automatically, and what needs
// a clear operator-facing message. The local ledger is always the source of
// truth while any of these are in flight — see consent-client.ts callers.
export type BlockchainErrorCode =
  | "WALLET_UNAVAILABLE"
  | "RPC_TIMEOUT"
  | "RPC_UNAVAILABLE"
  | "TRANSACTION_FAILED"
  | "CONFIRMATION_TIMEOUT"
  | "UNKNOWN";

export class BlockchainError extends Error {
  code: BlockchainErrorCode;
  retryable: boolean;
  cause?: unknown;

  constructor(code: BlockchainErrorCode, message: string, options?: { retryable?: boolean; cause?: unknown }) {
    super(message);
    this.name = "BlockchainError";
    this.code = code;
    this.retryable = options?.retryable ?? false;
    this.cause = options?.cause;
  }
}

export function classifyBlockchainError(err: unknown): BlockchainError {
  if (err instanceof BlockchainError) return err;

  const message = getErrorMessage(err);
  const lower = message.toLowerCase();

  if (lower.includes("timed out") || lower.includes("timeout")) {
    if (lower.includes("confirm")) {
      return new BlockchainError("CONFIRMATION_TIMEOUT", `Transaction sent but confirmation timed out: ${message}`, {
        retryable: true,
        cause: err,
      });
    }
    return new BlockchainError("RPC_TIMEOUT", `Solana RPC request timed out: ${message}`, {
      retryable: true,
      cause: err,
    });
  }

  if (
    lower.includes("econnrefused") ||
    lower.includes("enotfound") ||
    lower.includes("fetch failed") ||
    lower.includes("network") ||
    lower.includes("503") ||
    lower.includes("502") ||
    lower.includes("rate limit")
  ) {
    return new BlockchainError("RPC_UNAVAILABLE", `Solana devnet RPC unreachable: ${message}`, {
      retryable: true,
      cause: err,
    });
  }

  if (lower.includes("configuration error") || lower.includes("keypair") || lower.includes("enoent")) {
    return new BlockchainError("WALLET_UNAVAILABLE", `Backend service wallet unavailable: ${message}`, {
      retryable: false,
      cause: err,
    });
  }

  if (
    lower.includes("insufficient") ||
    lower.includes("custom program error") ||
    lower.includes("instruction error") ||
    lower.includes("simulation failed")
  ) {
    return new BlockchainError("TRANSACTION_FAILED", `Solana transaction failed: ${message}`, {
      retryable: false,
      cause: err,
    });
  }

  return new BlockchainError("UNKNOWN", message, { retryable: false, cause: err });
}

export interface WithRetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  onRetry?: (attempt: number, error: BlockchainError) => void;
}

// Retries only classified-retryable failures (RPC timeouts/unavailability),
// never wallet or transaction-logic failures — retrying those would just
// fail identically every time.
export async function withRetry<T>(fn: () => Promise<T>, options: WithRetryOptions = {}): Promise<T> {
  const attempts = options.attempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 500;

  let lastError: BlockchainError | null = null;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const classified = classifyBlockchainError(err);
      lastError = classified;

      if (!classified.retryable || attempt === attempts) {
        throw classified;
      }

      options.onRetry?.(attempt, classified);
      const delay = baseDelayMs * 2 ** (attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Unreachable — the loop above always returns or throws — but keeps TS satisfied.
  throw lastError ?? new BlockchainError("UNKNOWN", "Retry loop exited unexpectedly");
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new BlockchainError("RPC_TIMEOUT", `${label} timed out after ${timeoutMs}ms`, { retryable: true })), timeoutMs)
    ),
  ]);
}

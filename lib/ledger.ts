import crypto from "crypto";
import { dbService, ConsentLedgerEntry } from "./db";

/** Opaque, JSON-serialisable body hashed into a ledger entry. */
export type LedgerPayload = Record<string, unknown>;

/**
 * Computes the SHA-256 hash for a block in the consent ledger.
 * Format: SHA-256(prevHash + JSON.stringify({eventType, consentId, timestamp, payload})).
 */
export function computeBlockHash(
  prevHash: string,
  data: {
    eventType: string;
    consentId: string;
    timestamp: string;
    payload: LedgerPayload;
  }
): string {
  const input =
    prevHash +
    JSON.stringify({
      eventType: data.eventType,
      consentId: data.consentId,
      timestamp: data.timestamp,
      payload: data.payload,
    });

  return crypto.createHash("sha256").update(input).digest("hex");
}

/**
 * Appends a new entry to the consent ledger chain.
 */
export async function appendLedgerEntry(
  consentId: string,
  eventType: "GRANT" | "SCOPE_CHANGE" | "REVOKE" | "BANK_ACCESS",
  payload: LedgerPayload
): Promise<ConsentLedgerEntry> {
  const latestEntry = await dbService.getLatestLedgerEntry(consentId);
  const prevHash = latestEntry ? latestEntry.thisHash : "0".repeat(64);

  const timestamp = new Date().toISOString();
  const id = `block_${crypto.randomBytes(8).toString("hex")}`;
  const payloadHash = crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");

  const thisHash = computeBlockHash(prevHash, {
    eventType,
    consentId,
    timestamp,
    payload,
  });

  const entry: ConsentLedgerEntry = {
    id,
    consentId,
    eventType,
    timestamp,
    payloadHash,
    prevHash,
    thisHash,
    // Raw payload retained so the chain can be re-verified later.
    payload,
  };

  await dbService.createLedgerEntry(entry);
  return entry;
}

export interface VerificationResult {
  entry: ConsentLedgerEntry;
  verified: boolean;
  reason: string;
}

/**
 * Re-verifies all blocks for a given consentId.
 * Performs hash recomputation + prevHash pointer verification.
 */
export async function verifyLedgerChain(consentId: string): Promise<VerificationResult[]> {
  const entries = await dbService.listLedgerEntries(consentId);
  // Sort chronologically
  const sorted = [...entries].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  let expectedPrevHash = "0".repeat(64);
  const results: VerificationResult[] = [];

  for (const entry of sorted) {
    const payload = entry.payload || {};

    // 1. Recompute SHA-256 block hash
    const computedHash = computeBlockHash(entry.prevHash, {
      eventType: entry.eventType,
      consentId: entry.consentId,
      timestamp: entry.timestamp,
      payload,
    });

    const isThisHashValid = computedHash === entry.thisHash;
    const isPrevHashMatching = entry.prevHash === expectedPrevHash;

    const verified = isThisHashValid && isPrevHashMatching;
    let reason = "Block verified successfully.";
    if (!isThisHashValid) {
      reason = `Block hash mismatch. Computed: ${computedHash}, Stored: ${entry.thisHash}`;
    } else if (!isPrevHashMatching) {
      reason = `Previous hash pointer broken. Expected: ${expectedPrevHash}, Got: ${entry.prevHash}`;
    }

    results.push({
      entry,
      verified,
      reason,
    });

    // Advance expected pointer to the computed hash for downstream break detection
    expectedPrevHash = computedHash;
  }

  return results;
}

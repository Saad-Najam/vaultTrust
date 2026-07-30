import crypto from "crypto";
import { getAdminFirestore } from "./firebase_admin";

// Isolated fallback ledger — separate Firestore collections from the
// existing consentLedger/consents used by lib/db.ts and lib/ledger.ts.
const RECORDS_COLLECTION = "consent_ledger_fallback";
const META_COLLECTION = "consent_ledger_fallback_meta";
const META_DOC_ID = "chain_state";
const GENESIS_HASH = "0".repeat(64);

export type ConsentFallbackEventType = "grant" | "scope_change" | "revocation" | "bank_access";
export type ConsentFallbackStatus = "ACTIVE" | "REVOKED" | "PENDING";

export interface ConsentLedgerFallbackRecord {
  id: string;
  sequence: number;
  consent_id: string;
  event_type: ConsentFallbackEventType;
  purpose_hash: string;
  scope_hash: string;
  status: ConsentFallbackStatus;
  timestamp: string;
  previous_record_hash: string;
  record_hash: string;
}

export interface RecordConsentEventInput {
  consent_id: string;
  event_type: ConsentFallbackEventType;
  purpose: string;
  scope: string;
  status: ConsentFallbackStatus;
}

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

interface HashableRecordData {
  consent_id: string;
  event_type: ConsentFallbackEventType;
  purpose_hash: string;
  scope_hash: string;
  status: ConsentFallbackStatus;
  timestamp: string;
  sequence: number;
}

// Fixed key order so JSON.stringify output is stable across the chain.
function computeRecordHash(previousRecordHash: string, data: HashableRecordData): string {
  const canonical = JSON.stringify({
    consent_id: data.consent_id,
    event_type: data.event_type,
    purpose_hash: data.purpose_hash,
    scope_hash: data.scope_hash,
    status: data.status,
    timestamp: data.timestamp,
    sequence: data.sequence,
  });
  return sha256(previousRecordHash + canonical);
}

export async function recordConsentEvent(
  input: RecordConsentEventInput
): Promise<ConsentLedgerFallbackRecord> {
  const firestore = getAdminFirestore();
  const metaRef = firestore.collection(META_COLLECTION).doc(META_DOC_ID);
  const recordsCollection = firestore.collection(RECORDS_COLLECTION);

  const purpose_hash = sha256(input.purpose);
  const scope_hash = sha256(input.scope);
  const timestamp = new Date().toISOString();

  // Transaction claims the next sequence + previous hash atomically, so
  // concurrent appends can't race and corrupt the chain ordering.
  return firestore.runTransaction(async (tx) => {
    const metaSnap = await tx.get(metaRef);
    const metaData = metaSnap.exists ? metaSnap.data() : null;
    const previousRecordHash: string = metaData ? metaData.lastHash : GENESIS_HASH;
    const sequence: number = metaData ? metaData.sequence + 1 : 1;

    const record_hash = computeRecordHash(previousRecordHash, {
      consent_id: input.consent_id,
      event_type: input.event_type,
      purpose_hash,
      scope_hash,
      status: input.status,
      timestamp,
      sequence,
    });

    const id = `block_${String(sequence).padStart(8, "0")}`;
    const record: ConsentLedgerFallbackRecord = {
      id,
      sequence,
      consent_id: input.consent_id,
      event_type: input.event_type,
      purpose_hash,
      scope_hash,
      status: input.status,
      timestamp,
      previous_record_hash: previousRecordHash,
      record_hash,
    };

    tx.set(recordsCollection.doc(id), record);
    tx.set(metaRef, { sequence, lastHash: record_hash }, { merge: true });

    return record;
  });
}

export interface ConsentLedgerFallbackIssue {
  sequence: number;
  id: string;
  reason: string;
}

export interface ConsentLedgerFallbackVerification {
  valid: boolean;
  recordCount: number;
  issues: ConsentLedgerFallbackIssue[];
}

export async function verify(): Promise<ConsentLedgerFallbackVerification> {
  const firestore = getAdminFirestore();
  const snap = await firestore.collection(RECORDS_COLLECTION).orderBy("sequence", "asc").get();

  const records: ConsentLedgerFallbackRecord[] = [];
  snap.forEach((doc) => records.push(doc.data() as ConsentLedgerFallbackRecord));

  const issues: ConsentLedgerFallbackIssue[] = [];
  let expectedPreviousHash = GENESIS_HASH;

  for (const record of records) {
    const recomputedHash = computeRecordHash(record.previous_record_hash, {
      consent_id: record.consent_id,
      event_type: record.event_type,
      purpose_hash: record.purpose_hash,
      scope_hash: record.scope_hash,
      status: record.status,
      timestamp: record.timestamp,
      sequence: record.sequence,
    });

    if (record.previous_record_hash !== expectedPreviousHash) {
      issues.push({
        sequence: record.sequence,
        id: record.id,
        reason: `Chain pointer broken: expected previous_record_hash ${expectedPreviousHash}, found ${record.previous_record_hash}`,
      });
    }

    if (recomputedHash !== record.record_hash) {
      issues.push({
        sequence: record.sequence,
        id: record.id,
        reason: `Record tampered: recomputed hash ${recomputedHash} does not match stored record_hash ${record.record_hash}`,
      });
    }

    expectedPreviousHash = record.record_hash;
  }

  return {
    valid: issues.length === 0,
    recordCount: records.length,
    issues,
  };
}

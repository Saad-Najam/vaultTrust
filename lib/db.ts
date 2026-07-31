import { getAdminFirestore } from "./firebase_admin";
import { Platform } from "./platforms";

export type { Platform };

// Define Interfaces matching production specifications
export interface User {
  id: string; // uid from Firebase Auth
  name: string;
  email: string;
  role: "FREELANCER" | "BANK_OFFICER";
  kycStatus: "NOT_STARTED" | "SIMULATED_PASS" | "VERIFIED" | "FAILED";
  createdAt: string;
  photoURL?: string;
}

export interface FreelancerProfile {
  userId: string;
  city: string;
  monthlyIncomeMin: number;
  monthlyIncomeMax: number;
}

export interface ConnectedSource {
  id: string; // e.g. platform name or uuid
  freelancerId: string;
  platform: Platform;
  status: "CONNECTED" | "DISCONNECTED";
  connectedAt: string;
  provider: "sandbox" | "live";
  // Last time transactions were actually pulled from the provider for this
  // source — stamped on connect and on every explicit sync, so the UI can
  // show a real age rather than the time the page happened to load.
  lastSyncedAt?: string;
}

/**
 * A linked credit card and its latest statement. Stored separately from
 * `Transaction` because these are obligations, not earnings — keeping them out
 * of the transaction collection means they can never be swept into income
 * aggregation by accident.
 */
export interface CreditCardAccount {
  id: string;
  freelancerId: string;
  /** The ConnectedSource (platform CREDIT_CARD) this card belongs to. */
  sourceId: string;
  provider: string; // e.g. "UBL Master Card"
  last4: string;
  creditLimitPKR: number;
  statementBalancePKR: number;
  minPaymentDuePKR: number;
  statementDate: string; // ISO
  /** Repayment history, used for the on-time badge. */
  onTimePayments: number;
  totalPayments: number;
  lastSyncedAt: string;
}

export interface Transaction {
  id: string;
  sourceId: string;
  freelancerId: string;
  amount: number;
  currency: string;
  date: string; // ISO string
  clientLabel: string;
}

export interface Consent {
  id: string; // freelancerId_bankId
  freelancerId: string;
  bankId: string;
  sources: Platform[];
  scope: string;
  duration: "ONE_TIME" | "ROLLING_6MO";
  purpose: string;
  status: "ACTIVE" | "REVOKED";
  grantedAt: string;
  revokedAt: string | null;
  // Blockchain anchoring (best-effort; the ledger fields above are the
  // guaranteed source of truth regardless of blockchain availability).
  blockchainStatus?: "CONFIRMED" | "FAILED" | "PENDING_RETRY";
  solanaTxSignature?: string;
  solanaConsentPda?: string;
  blockchainError?: string;
}

export interface ConsentLedgerEntry {
  id: string;
  consentId: string;
  eventType: "GRANT" | "SCOPE_CHANGE" | "REVOKE" | "BANK_ACCESS" | "LOAN_OFFER";
  timestamp: string; // ISO string
  payloadHash: string;
  prevHash: string;
  thisHash: string;
  /**
   * The raw event body, persisted so the chain can be re-verified later.
   * `payloadHash` is the authoritative digest; this is what it hashes.
   */
  payload?: Record<string, unknown>;
}

/**
 * A lending decision recorded by a bank officer. Stored separately from
 * `Consent` because it is the bank's own action — revoking consent stops
 * further data access but must not erase the record that an offer was made.
 */
export interface LoanOffer {
  id: string; // freelancerId_bankId
  consentId: string;
  freelancerId: string;
  bankId: string;
  /** Offer ceiling at approval time, in PKR. */
  amountPKR: number;
  /** Eligibility tier the offer was based on. */
  tier: string;
  tierLabel: string;
  /** Snapshot of the score the decision was made against, for auditability. */
  ivsAtApproval: number;
  approvedBy: string;
  approvedAt: string;
  status: "OFFERED";
}

export interface IncomeScore {
  freelancerId: string;
  avgMonthlyIncome: number;
  coefficientOfVariation: number;
  trend: "GROWING" | "STABLE" | "DECLINING";
  sourceDiversityScore: number;
  ivs: number;
  eligibilityBandPKR: string;
  computedAt: string;
}

// Database Service implementing direct Firestore calls only
export const dbService = {
  // --- USERS ---
  async getUser(id: string): Promise<User | null> {
    const firestore = getAdminFirestore();
    const snap = await firestore.collection("users").doc(id).get();
    return snap.exists ? (snap.data() as User) : null;
  },

  async createUser(user: User): Promise<void> {
    const firestore = getAdminFirestore();
    await firestore.collection("users").doc(user.id).set(user);
  },

  async updateUser(id: string, fields: Partial<User>): Promise<void> {
    const firestore = getAdminFirestore();
    await firestore.collection("users").doc(id).update(fields);
  },

  // Merge-write variant used by self-service profile edits. `update()` throws
  // NOT_FOUND when the doc is missing (e.g. an auth account whose registration
  // half-completed), which would leave that user unable to fix their profile.
  async upsertUser(id: string, fields: Partial<User>): Promise<void> {
    const firestore = getAdminFirestore();
    await firestore.collection("users").doc(id).set(fields, { merge: true });
  },

  async listUsers(): Promise<User[]> {
    const firestore = getAdminFirestore();
    const snap = await firestore.collection("users").get();
    const users: User[] = [];
    snap.forEach((doc) => users.push(doc.data() as User));
    return users;
  },

  // --- PROFILES ---
  async getFreelancerProfile(userId: string): Promise<FreelancerProfile | null> {
    const firestore = getAdminFirestore();
    const snap = await firestore.collection("freelancerProfiles").doc(userId).get();
    return snap.exists ? (snap.data() as FreelancerProfile) : null;
  },

  async createFreelancerProfile(profile: FreelancerProfile): Promise<void> {
    const firestore = getAdminFirestore();
    await firestore.collection("freelancerProfiles").doc(profile.userId).set(profile);
  },

  // --- CONNECTED SOURCES ---
  // Firestore: connectedSources/{uid}/sources/{sourceId}
  async listConnectedSources(freelancerId: string): Promise<ConnectedSource[]> {
    const firestore = getAdminFirestore();
    const snap = await firestore
      .collection("connectedSources")
      .doc(freelancerId)
      .collection("sources")
      .get();
    const list: ConnectedSource[] = [];
    snap.forEach((doc) => list.push(doc.data() as ConnectedSource));
    return list;
  },

  async getConnectedSource(freelancerId: string, sourceId: string): Promise<ConnectedSource | null> {
    const firestore = getAdminFirestore();
    const snap = await firestore
      .collection("connectedSources")
      .doc(freelancerId)
      .collection("sources")
      .doc(sourceId)
      .get();
    return snap.exists ? (snap.data() as ConnectedSource) : null;
  },

  async createConnectedSource(source: ConnectedSource): Promise<void> {
    const firestore = getAdminFirestore();
    await firestore
      .collection("connectedSources")
      .doc(source.freelancerId)
      .collection("sources")
      .doc(source.id)
      .set(source);
  },

  async updateConnectedSource(
    freelancerId: string,
    sourceId: string,
    fields: Partial<ConnectedSource>
  ): Promise<void> {
    const firestore = getAdminFirestore();
    await firestore
      .collection("connectedSources")
      .doc(freelancerId)
      .collection("sources")
      .doc(sourceId)
      .update(fields);
  },

  // --- CREDIT CARDS ---
  // Firestore: creditCards/{uid}/cards/{cardId}
  async listCreditCards(freelancerId: string): Promise<CreditCardAccount[]> {
    const firestore = getAdminFirestore();
    const snap = await firestore
      .collection("creditCards")
      .doc(freelancerId)
      .collection("cards")
      .get();
    const list: CreditCardAccount[] = [];
    snap.forEach((doc) => list.push(doc.data() as CreditCardAccount));
    return list;
  },

  async getCreditCard(
    freelancerId: string,
    cardId: string
  ): Promise<CreditCardAccount | null> {
    const firestore = getAdminFirestore();
    const snap = await firestore
      .collection("creditCards")
      .doc(freelancerId)
      .collection("cards")
      .doc(cardId)
      .get();
    return snap.exists ? (snap.data() as CreditCardAccount) : null;
  },

  async upsertCreditCard(card: CreditCardAccount): Promise<void> {
    const firestore = getAdminFirestore();
    await firestore
      .collection("creditCards")
      .doc(card.freelancerId)
      .collection("cards")
      .doc(card.id)
      .set(card, { merge: true });
  },

  async deleteCreditCard(freelancerId: string, cardId: string): Promise<void> {
    const firestore = getAdminFirestore();
    await firestore
      .collection("creditCards")
      .doc(freelancerId)
      .collection("cards")
      .doc(cardId)
      .delete();
  },

  // --- TRANSACTIONS ---
  // Firestore: transactions/{uid}/sources/{sourceId}/records/{txId}
  async listTransactions(freelancerId: string): Promise<Transaction[]> {
    const firestore = getAdminFirestore();
    // Fetch connected sources first
    const sourcesSnap = await firestore
      .collection("connectedSources")
      .doc(freelancerId)
      .collection("sources")
      .get();
    
    const allTx: Transaction[] = [];
    for (const srcDoc of sourcesSnap.docs) {
      const sourceId = srcDoc.id;
      const txSnap = await firestore
        .collection("transactions")
        .doc(freelancerId)
        .collection("sources")
        .doc(sourceId)
        .collection("records")
        .get();
      
      txSnap.forEach((doc) => allTx.push(doc.data() as Transaction));
    }
    return allTx;
  },

  async listTransactionsForSource(freelancerId: string, sourceId: string): Promise<Transaction[]> {
    const firestore = getAdminFirestore();
    const snap = await firestore
      .collection("transactions")
      .doc(freelancerId)
      .collection("sources")
      .doc(sourceId)
      .collection("records")
      .get();
    const list: Transaction[] = [];
    snap.forEach((doc) => list.push(doc.data() as Transaction));
    return list;
  },

  async bulkCreateTransactions(
    freelancerId: string,
    sourceId: string,
    transactions: Transaction[]
  ): Promise<void> {
    const firestore = getAdminFirestore();
    const batch = firestore.batch();
    const baseRef = firestore
      .collection("transactions")
      .doc(freelancerId)
      .collection("sources")
      .doc(sourceId)
      .collection("records");
    
    for (const t of transactions) {
      const docRef = baseRef.doc(t.id);
      batch.set(docRef, t);
    }
    await batch.commit();
  },

  // --- CONSENT ---
  // Firestore: consents/{consentId}
  async getConsent(id: string): Promise<Consent | null> {
    const firestore = getAdminFirestore();
    const snap = await firestore.collection("consents").doc(id).get();
    return snap.exists ? (snap.data() as Consent) : null;
  },

  async getActiveConsent(freelancerId: string, bankId?: string): Promise<Consent | null> {
    const firestore = getAdminFirestore();
    let queryRef = firestore
      .collection("consents")
      .where("freelancerId", "==", freelancerId)
      .where("status", "==", "ACTIVE");
    
    if (bankId) {
      queryRef = queryRef.where("bankId", "==", bankId);
    }
    
    const snap = await queryRef.get();
    let active: Consent | null = null;
    snap.forEach((doc) => {
      active = doc.data() as Consent;
    });
    return active;
  },

  async listConsentsForBank(bankId: string): Promise<Consent[]> {
    const firestore = getAdminFirestore();
    const snap = await firestore
      .collection("consents")
      .where("bankId", "==", bankId)
      .get();
    return snap.docs
      .map((doc) => doc.data() as Consent)
      .sort((a, b) => new Date(b.grantedAt).getTime() - new Date(a.grantedAt).getTime());
  },

  async createConsent(consent: Consent): Promise<void> {
    const firestore = getAdminFirestore();
    await firestore.collection("consents").doc(consent.id).set(consent);
  },

  async updateConsent(id: string, fields: Partial<Consent>): Promise<void> {
    const firestore = getAdminFirestore();
    await firestore.collection("consents").doc(id).update(fields);
  },

  // Compensating-action helper for rollback safety: used when a later step
  // in a multi-write sequence (e.g. the ledger append after consent creation)
  // fails, so we don't leave an orphaned consent record with no audit trail.
  async deleteConsent(id: string): Promise<void> {
    const firestore = getAdminFirestore();
    await firestore.collection("consents").doc(id).delete();
  },

  // --- LOAN OFFERS ---
  // Firestore: loanOffers/{freelancerId_bankId}
  async getLoanOffer(freelancerId: string, bankId: string): Promise<LoanOffer | null> {
    const firestore = getAdminFirestore();
    const snap = await firestore.collection("loanOffers").doc(`${freelancerId}_${bankId}`).get();
    return snap.exists ? (snap.data() as LoanOffer) : null;
  },

  async createLoanOffer(offer: LoanOffer): Promise<void> {
    const firestore = getAdminFirestore();
    await firestore.collection("loanOffers").doc(offer.id).set(offer);
  },

  // --- LEDGER ---
  // Firestore: consentLedger/{consentId}/entries/{entryId}
  async listLedgerEntries(consentId: string): Promise<ConsentLedgerEntry[]> {
    const firestore = getAdminFirestore();
    const snap = await firestore
      .collection("consentLedger")
      .doc(consentId)
      .collection("entries")
      .orderBy("timestamp", "asc")
      .get();
    
    const list: ConsentLedgerEntry[] = [];
    snap.forEach((doc) => list.push(doc.data() as ConsentLedgerEntry));
    return list;
  },

  async listLedgerEntriesForFreelancer(freelancerId: string): Promise<ConsentLedgerEntry[]> {
    const firestore = getAdminFirestore();
    // Fetch all consents for the freelancer
    const consentsSnap = await firestore
      .collection("consents")
      .where("freelancerId", "==", freelancerId)
      .get();
    
    const allEntries: ConsentLedgerEntry[] = [];
    for (const consentDoc of consentsSnap.docs) {
      const consentId = consentDoc.id;
      const entriesSnap = await firestore
        .collection("consentLedger")
        .doc(consentId)
        .collection("entries")
        .get();
      
      entriesSnap.forEach((doc) => allEntries.push(doc.data() as ConsentLedgerEntry));
    }
    return allEntries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  },

  async listLedgerEntriesForBank(bankId: string): Promise<ConsentLedgerEntry[]> {
    const firestore = getAdminFirestore();
    const consentsSnap = await firestore
      .collection("consents")
      .where("bankId", "==", bankId)
      .get();

    const allEntries: ConsentLedgerEntry[] = [];
    for (const consentDoc of consentsSnap.docs) {
      const consentId = consentDoc.id;
      const entriesSnap = await firestore
        .collection("consentLedger")
        .doc(consentId)
        .collection("entries")
        .get();

      entriesSnap.forEach((doc) => allEntries.push(doc.data() as ConsentLedgerEntry));
    }
    return allEntries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  },

  async createLedgerEntry(entry: ConsentLedgerEntry): Promise<void> {
    const firestore = getAdminFirestore();
    await firestore
      .collection("consentLedger")
      .doc(entry.consentId)
      .collection("entries")
      .doc(entry.id)
      .set(entry);
  },

  async getLatestLedgerEntry(consentId: string): Promise<ConsentLedgerEntry | null> {
    const firestore = getAdminFirestore();
    const snap = await firestore
      .collection("consentLedger")
      .doc(consentId)
      .collection("entries")
      .orderBy("timestamp", "desc")
      .limit(1)
      .get();
    
    return !snap.empty ? (snap.docs[0].data() as ConsentLedgerEntry) : null;
  },

  // --- INCOME SCORES ---
  // Firestore: incomeScores/{uid}
  async getIncomeScore(freelancerId: string): Promise<IncomeScore | null> {
    const firestore = getAdminFirestore();
    const snap = await firestore.collection("incomeScores").doc(freelancerId).get();
    return snap.exists ? (snap.data() as IncomeScore) : null;
  },

  async upsertIncomeScore(score: IncomeScore): Promise<void> {
    const firestore = getAdminFirestore();
    await firestore.collection("incomeScores").doc(score.freelancerId).set(score);
  },

  // Reset/Empty Helper (Used for Seeding or testing)
  async clearAll(): Promise<void> {
    const firestore = getAdminFirestore();
    const collections = [
      "users",
      "freelancerProfiles",
      "connectedSources",
      "creditCards",
      "transactions",
      "consents",
      "consentLedger",
      "incomeScores",
    ];
    for (const col of collections) {
      const snap = await firestore.collection(col).get();
      for (const doc of snap.docs) {
        await firestore.recursiveDelete(doc.ref);
      }
    }
  },
};

/**
 * Wire shapes returned by the /api/v1 routes.
 *
 * Client components import these instead of using `any`, so a field rename in
 * a route surfaces as a compile error in the pages that read it.
 *
 * Everything here is `import type` only — these modules reach into
 * firebase-admin at runtime, and a value import would drag server-only code
 * into the client bundle.
 */
import type { Consent, ConsentLedgerEntry, CreditCardAccount } from "./db";
import type { IncomePlatform, Platform } from "./platforms";
import type { ScoreBreakdown, SpendCreditMetrics } from "./scoring";
import type { EligibilityAssessment, DisclosureStatus } from "./eligibility";

export type { Consent, ConsentLedgerEntry, CreditCardAccount };
export type { SpendCreditMetrics, EligibilityAssessment, DisclosureStatus };

/** A connected source as returned by the summary route. */
export interface ConnectedSourceView {
  id: string;
  freelancerId: string;
  platform: Platform;
  status: "CONNECTED" | "DISCONNECTED";
  connectedAt: string;
  provider: string;
  lastSyncedAt?: string | null;
  transactionCount?: number;
}

export interface TransactionView {
  id: string;
  sourceId: string;
  freelancerId: string;
  amount: number;
  currency: string;
  date: string;
  clientLabel: string;
}

export interface MonthlyAggregate {
  monthLabel: string;
  year: number;
  month: number;
  totalPKR: number;
  byPlatform: Record<IncomePlatform, number>;
}

export interface IncomeScoreView {
  ivs: number;
  avgMonthlyIncome: number;
  trend: "GROWING" | "STABLE" | "DECLINING";
  sourceDiversityScore: number;
  eligibilityBandPKR: string;
  computedAt: string;
}

/** GET /api/v1/connectors/summary */
export interface SummaryResponse {
  success: boolean;
  userId: string;
  connectedSources: ConnectedSourceView[];
  recentTransactions: TransactionView[];
  monthlyAggregates: MonthlyAggregate[];
  sourceMix: Record<IncomePlatform, number>;
  incomeScore: IncomeScoreView | null;
  currentMonthTotalPKR: number;
  totalTransactions: number;
  distinctClientCount: number;
  creditCards: CreditCardAccount[];
  spendCredit: SpendCreditMetrics | null;
}

/** GET /api/v1/profile/reliability */
export interface ReliabilityResponse {
  success: boolean;
  userId: string;
  userName: string;
  city: string;
  scores: {
    avgMonthlyIncome: number;
    coefficientOfVariation: number;
    trend: "GROWING" | "STABLE" | "DECLINING";
    sourceDiversityScore: number;
    ivs: number;
    eligibilityBandPKR: string;
    breakdown: ScoreBreakdown;
    incomeScore: number;
    consistencyScore: number;
    trendScore: number;
    diversityScore: number;
  };
  spendCredit: SpendCreditMetrics;
  eligibility: EligibilityAssessment;
  explanation?: string;
  improvementSuggestions?: string[];
  improvementDisclaimer?: string;
}

/** Ledger entry with its chain-verification result attached. */
export interface VerifiedLedgerEntry extends ConsentLedgerEntry {
  verified?: boolean;
  reason?: string;
}

/** GET /api/v1/consent/[id]/verify */
export interface VerificationResponse {
  success: boolean;
  consentId?: string;
  status?: "VERIFIED" | "TAMPERED" | "BLOCKCHAIN_PENDING";
  reasons?: string[];
  transactionSignature?: string | null;
  programId?: string;
  timestamp?: string;
  localLedger?: { intact: boolean; entryCount: number };
  onChain?: {
    status: string;
    purposeHash: string;
    scopeHash: string;
    grantedAt: string | number;
    updatedAt: string | number;
    lastAccessedAt: string | number;
  } | null;
  onChainError?: string | null;
  error?: string;
}

/** Outflow disclosure block on the bank-facing assessment. */
export interface OutflowDisclosureView {
  status: DisclosureStatus;
  shared: boolean;
  metrics: {
    dtiPercent: number | null;
    dtiTier: "LOW" | "MODERATE" | "HIGH";
    utilizationPercent: number | null;
    onTimeRepaymentPercent: number | null;
    netFreeCashFlowPKR: number;
    totalMonthlyObligationPKR: number;
    cardCount: number;
    badges: SpendCreditMetrics["badges"];
  } | null;
  recommendedOfferPKR: number;
}

/** GET /api/v1/lending/assess?freelancerId=… */
export interface ApplicantDetailResponse {
  success: boolean;
  freelancerId: string;
  name: string;
  city: string;
  consentInfo: {
    consentId: string;
    grantedAt: string;
    sourcesShared: Platform[];
    scope: string;
    duration: string;
  };
  incomeProfile: {
    avgMonthlyIncome: number;
    coefficientOfVariation: number;
    trend: "GROWING" | "STABLE" | "DECLINING";
    sourceDiversityScore: number;
    ivs: number;
    indicativeIncomeOnlyBandPKR: string;
    breakdown: ScoreBreakdown;
  };
  eligibility: EligibilityAssessment;
  outflowDisclosure: OutflowDisclosureView;
  rawTransactions?: TransactionView[];
}

/** One row of GET /api/v1/lending/assess (list mode). */
export interface ApplicantListItem {
  id: string;
  name: string;
  email: string;
  city: string;
  consentStatus: "ACTIVE" | "NONE";
  consentId: string | null;
  grantedAt: string | null;
  avgMonthlyIncome: number;
  ivs: number;
  trend: "GROWING" | "STABLE" | "DECLINING";
  eligibilityTier: EligibilityAssessment["tier"] | null;
  eligibilityLabel: string | null;
  outflowDisclosure: DisclosureStatus | null;
  eligibilityCapped: boolean;
}

/** One row of /api/v1/consent/bank-status — a consent (active or revoked)
 *  granted to the calling bank. */
export interface BankConsentStatusItem {
  consentId: string;
  freelancerId: string;
  freelancerName: string;
  status: "ACTIVE" | "REVOKED";
  duration: "ONE_TIME" | "ROLLING_6MO";
  sources: string[];
  grantedAt: string;
  revokedAt: string | null;
  blockchainStatus: "CONFIRMED" | "FAILED" | "PENDING_RETRY" | null;
}

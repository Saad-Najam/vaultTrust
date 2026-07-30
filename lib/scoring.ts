import { CreditCardAccount, Transaction } from "./db";

const FX_RATES: Record<string, number> = {
  USD: 280,
  EUR: 300,
  PKR: 1,
};

// A single factor's contribution to the final `ivs` — `points`/`maxPoints` are
// literally `weight * rawScore` / `weight * 100` for that same weight already
// used in the ivs formula below, not a re-derivation.
export interface ScoreBreakdownFactor {
  label: string;
  rawScore: number; // the underlying 0-100 sub-score, before weighting
  points: number; // weighted contribution actually added to ivs
  maxPoints: number; // weighted contribution if this factor were a perfect 100
}

export interface ScoreBreakdown {
  incomeLevel: ScoreBreakdownFactor;
  incomeStability: ScoreBreakdownFactor;
  trend: ScoreBreakdownFactor;
  clientDiversity: ScoreBreakdownFactor;
}

export interface ComputedScoreResult {
  avgMonthlyIncome: number;
  coefficientOfVariation: number;
  trend: "GROWING" | "STABLE" | "DECLINING";
  sourceDiversityScore: number;
  ivs: number;
  eligibilityBandPKR: string;
  breakdown: ScoreBreakdown;
}

/**
 * Normalizes a transaction amount to PKR based on its currency.
 */
export function normalizeAmountToPKR(amount: number, currency: string): number {
  const rate = FX_RATES[currency.toUpperCase()] || 1;
  return amount * rate;
}

/**
 * Computes a freelancer's Income Verification Score (IVS) and associated metrics
 * based on transaction history from connected, consented sources.
 *
 * IVS (0-100) Formula:
 * - 40% Income Level: Normalized against a floor (50k PKR) and ceiling (300k PKR).
 * - 25% Consistency: Inverse of the Coefficient of Variation (CoV) of monthly totals.
 * - 20% Trend: Linear regression slope over the last 6 months (GROWING/STABLE/DECLINING).
 * - 15% Diversity: Penetration penalty (1 - largest source's share of total income).
 */
export function computeIncomeScore(transactions: Transaction[]): ComputedScoreResult {
  if (transactions.length === 0) {
    return {
      avgMonthlyIncome: 0,
      coefficientOfVariation: 0,
      trend: "STABLE",
      sourceDiversityScore: 0,
      ivs: 0,
      eligibilityBandPKR: "Micro-credit / BNPL up to PKR 30,000",
      breakdown: {
        incomeLevel: { label: "Income Level", rawScore: 0, points: 0, maxPoints: 40 },
        incomeStability: { label: "Income Stability", rawScore: 0, points: 0, maxPoints: 25 },
        trend: { label: "Income Trend", rawScore: 0, points: 0, maxPoints: 20 },
        clientDiversity: { label: "Client Diversity", rawScore: 0, points: 0, maxPoints: 15 },
      },
    };
  }

  // 1. Group transactions into the last 6 calendar months (relative to now)
  const now = new Date();
  const monthlyTotals = Array(6).fill(0);
  
  // Create boundaries for the last 6 months (month 5 = current month, month 0 = 5 months ago)
  const monthKeys = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  // Calculate totals per month and track source distribution
  const sourceTotals: Record<string, number> = {};
  let overallTotalPKR = 0;

  transactions.forEach((tx) => {
    const txDate = new Date(tx.date);
    const txYear = txDate.getFullYear();
    const txMonth = txDate.getMonth();
    const amountPKR = normalizeAmountToPKR(tx.amount, tx.currency);

    // Add to monthly total if it falls in our 6-month window
    const monthIndex = monthKeys.findIndex((mk) => mk.year === txYear && mk.month === txMonth);
    if (monthIndex >= 0 && monthIndex < 6) {
      monthlyTotals[monthIndex] += amountPKR;
    }

    // Accumulate total by source for diversity check
    sourceTotals[tx.sourceId] = (sourceTotals[tx.sourceId] || 0) + amountPKR;
    overallTotalPKR += amountPKR;
  });

  // 2. Average Monthly Income
  const avgMonthlyIncome = Math.round(monthlyTotals.reduce((sum, val) => sum + val, 0) / 6);

  // 3. Coefficient of Variation (CoV) = Standard Deviation / Mean
  let stdDev = 0;
  if (avgMonthlyIncome > 0) {
    const variance = monthlyTotals.reduce((sum, val) => sum + Math.pow(val - avgMonthlyIncome, 2), 0) / 6;
    stdDev = Math.sqrt(variance);
  }
  const coefficientOfVariation = avgMonthlyIncome > 0 ? stdDev / avgMonthlyIncome : 0;

  // 4. Trend (Linear regression slope over index 0 to 5)
  // y = monthlyTotals, x = [0, 1, 2, 3, 4, 5]
  // mean_x = 2.5
  // slope = sum((x_i - mean_x) * (y_i - mean_y)) / sum((x_i - mean_x)^2)
  // sum((x_i - 2.5)^2) = (-2.5)^2 + (-1.5)^2 + (-0.5)^2 + 0.5^2 + 1.5^2 + 2.5^2 = 6.25 + 2.25 + 0.25 + 0.25 + 2.25 + 6.25 = 17.5
  let slope = 0;
  if (avgMonthlyIncome > 0) {
    let num = 0;
    for (let i = 0; i < 6; i++) {
      num += (i - 2.5) * (monthlyTotals[i] - avgMonthlyIncome);
    }
    slope = num / 17.5;
  }

  // Trend categorization
  // If slope is positive and greater than 5% of monthly average -> GROWING
  // If slope is negative and less than -5% of monthly average -> DECLINING
  // Otherwise -> STABLE
  let trend: "GROWING" | "STABLE" | "DECLINING" = "STABLE";
  if (avgMonthlyIncome > 0) {
    const threshold = 0.05 * avgMonthlyIncome;
    if (slope > threshold) {
      trend = "GROWING";
    } else if (slope < -threshold) {
      trend = "DECLINING";
    }
  }

  // 5. Source Diversity Score (1 - largest single source's share)
  let sourceDiversityScore = 0;
  if (overallTotalPKR > 0) {
    const largestSourceTotal = Math.max(...Object.values(sourceTotals));
    sourceDiversityScore = 1 - largestSourceTotal / overallTotalPKR;
  }

  // 6. IVS Score (0-100) Calculation
  // Component A: Income Level (Normalized between 50k PKR and 300k PKR)
  const floorIncome = 50000;
  const ceilingIncome = 300000;
  const incomeScore = avgMonthlyIncome <= floorIncome
    ? 0
    : avgMonthlyIncome >= ceilingIncome
      ? 100
      : ((avgMonthlyIncome - floorIncome) / (ceilingIncome - floorIncome)) * 100;

  // Component B: Income Consistency (inverse of CoV)
  // A CoV of 0 is perfect consistency (100 pts). A CoV >= 1 has zero consistency (0 pts).
  const consistencyScore = Math.max(0, Math.min(100, (1 - coefficientOfVariation) * 100));

  // Component C: Income Trend
  const trendScore = trend === "GROWING" ? 100 : trend === "STABLE" ? 70 : 40;

  // Component D: Source Diversity Score
  const diversityScore = Math.min(100, sourceDiversityScore * 100);

  // Weighted composite IVS
  const ivs = Math.round(
    0.40 * incomeScore +
    0.25 * consistencyScore +
    0.20 * trendScore +
    0.15 * diversityScore
  );

  // 7. Tiered Eligibility Band
  let eligibilityBandPKR = "Micro-credit / BNPL up to PKR 30,000";
  if (ivs >= 80) {
    eligibilityBandPKR = "Platinum Credit Card / Personal Loan up to PKR 500,000";
  } else if (ivs >= 60) {
    eligibilityBandPKR = "Gold Credit Card / Personal Loan up to PKR 250,000";
  } else if (ivs >= 40) {
    eligibilityBandPKR = "Classic Credit Card / BNPL up to PKR 100,000";
  }

  // Breakdown — same incomeScore/consistencyScore/trendScore/diversityScore
  // and same 0.40/0.25/0.20/0.15 weights already used for `ivs` above, just
  // also exposed per-factor instead of only as their combined sum.
  const breakdown: ScoreBreakdown = {
    incomeLevel: {
      label: "Income Level",
      rawScore: Math.round(incomeScore),
      points: Math.round(0.4 * incomeScore),
      maxPoints: 40,
    },
    incomeStability: {
      label: "Income Stability",
      rawScore: Math.round(consistencyScore),
      points: Math.round(0.25 * consistencyScore),
      maxPoints: 25,
    },
    trend: {
      label: "Income Trend",
      rawScore: Math.round(trendScore),
      points: Math.round(0.2 * trendScore),
      maxPoints: 20,
    },
    clientDiversity: {
      label: "Client Diversity",
      rawScore: Math.round(diversityScore),
      points: Math.round(0.15 * diversityScore),
      maxPoints: 15,
    },
  };

  return {
    avgMonthlyIncome,
    coefficientOfVariation,
    trend,
    sourceDiversityScore,
    ivs,
    eligibilityBandPKR,
    breakdown,
  };
}

// ─── SpendSmart / Credit Card Intelligence ────────────────────────────────────

/** Recommended-limit guard rails, so an outlier month can't produce a silly offer. */
const RECOMMENDED_LIMIT_FLOOR_PKR = 25_000;
const RECOMMENDED_LIMIT_CEILING_PKR = 1_000_000;
/** Offers are rounded down to this step to read like a real bank product. */
const RECOMMENDED_LIMIT_STEP_PKR = 10_000;
/** Multiple of monthly free cash flow a partner bank will extend. */
const FREE_CASH_FLOW_MULTIPLE = 3.5;

export type DtiTier = "LOW" | "MODERATE" | "HIGH";
export type BadgeStatus = "HEALTHY" | "WATCH" | "AT_RISK" | "UNKNOWN";

export interface SpendCreditBadge {
  label: string;
  status: BadgeStatus;
  detail: string;
}

export interface SpendCreditMetrics {
  hasCards: boolean;
  cardCount: number;

  totalCreditLimitPKR: number;
  totalStatementBalancePKR: number;
  /** Sum of minimum payments due — the recurring monthly obligation. */
  totalMonthlyObligationPKR: number;

  /** Balance as a share of limit. Null when no limit is known. */
  utilizationPercent: number | null;
  /** (obligations / verified monthly income) * 100. Null when income is unknown. */
  dtiPercent: number | null;
  dtiTier: DtiTier;

  verifiedMonthlyIncomePKR: number;
  netFreeCashFlowPKR: number;
  recommendedCreditLimitPKR: number;

  onTimeRepaymentPercent: number | null;

  badges: {
    utilization: SpendCreditBadge;
    repayment: SpendCreditBadge;
    dti: SpendCreditBadge;
  };
}

function tierForDti(dtiPercent: number | null, hasObligations: boolean): DtiTier {
  // No income on record but real obligations is the worst case, not the best —
  // a naive `obligations / 0` would yield Infinity, so it is handled explicitly.
  if (dtiPercent === null) return hasObligations ? "HIGH" : "LOW";
  if (dtiPercent < 20) return "LOW";
  if (dtiPercent <= 35) return "MODERATE";
  return "HIGH";
}

/**
 * Derives spending/credit health from linked cards and verified income.
 *
 * Kept separate from `computeIncomeScore` so that obligations can never leak
 * into the IVS: income scoring answers "how reliable are the earnings", this
 * answers "how much of them is already committed".
 *
 * - DTI            = (monthly card obligations / verified monthly income) * 100
 * - Net free cash  = verified monthly income − monthly card obligations
 * - Recommended    = net free cash × 3.5, clamped to a healthy band
 */
export function computeSpendCreditMetrics(
  cards: CreditCardAccount[],
  verifiedMonthlyIncomePKR: number
): SpendCreditMetrics {
  const totalCreditLimitPKR = cards.reduce((s, c) => s + (c.creditLimitPKR || 0), 0);
  const totalStatementBalancePKR = cards.reduce(
    (s, c) => s + (c.statementBalancePKR || 0),
    0
  );
  const totalMonthlyObligationPKR = cards.reduce(
    (s, c) => s + (c.minPaymentDuePKR || 0),
    0
  );

  const utilizationPercent =
    totalCreditLimitPKR > 0
      ? Math.round((totalStatementBalancePKR / totalCreditLimitPKR) * 100)
      : null;

  const income = Math.max(0, verifiedMonthlyIncomePKR || 0);
  const dtiPercent =
    income > 0 ? Math.round((totalMonthlyObligationPKR / income) * 100) : null;
  const dtiTier = tierForDti(dtiPercent, totalMonthlyObligationPKR > 0);

  // Free cash flow can legitimately go negative (obligations exceed earnings);
  // that is signal, so it is reported as-is rather than floored at zero.
  const netFreeCashFlowPKR = Math.round(income - totalMonthlyObligationPKR);

  const rawRecommended = netFreeCashFlowPKR * FREE_CASH_FLOW_MULTIPLE;
  const recommendedCreditLimitPKR =
    netFreeCashFlowPKR <= 0 || income <= 0
      ? 0
      : Math.min(
          RECOMMENDED_LIMIT_CEILING_PKR,
          Math.max(
            RECOMMENDED_LIMIT_FLOOR_PKR,
            Math.floor(rawRecommended / RECOMMENDED_LIMIT_STEP_PKR) *
              RECOMMENDED_LIMIT_STEP_PKR
          )
        );

  const totalPayments = cards.reduce((s, c) => s + (c.totalPayments || 0), 0);
  const onTimePayments = cards.reduce((s, c) => s + (c.onTimePayments || 0), 0);
  const onTimeRepaymentPercent =
    totalPayments > 0 ? Math.round((onTimePayments / totalPayments) * 100) : null;

  return {
    hasCards: cards.length > 0,
    cardCount: cards.length,
    totalCreditLimitPKR,
    totalStatementBalancePKR,
    totalMonthlyObligationPKR,
    utilizationPercent,
    dtiPercent,
    dtiTier,
    verifiedMonthlyIncomePKR: income,
    netFreeCashFlowPKR,
    recommendedCreditLimitPKR,
    onTimeRepaymentPercent,
    badges: {
      utilization: {
        label: "Credit Utilisation",
        status:
          utilizationPercent === null
            ? "UNKNOWN"
            : utilizationPercent < 30
              ? "HEALTHY"
              : utilizationPercent <= 50
                ? "WATCH"
                : "AT_RISK",
        detail:
          utilizationPercent === null
            ? "No card linked"
            : utilizationPercent < 30
              ? `${utilizationPercent}% — healthy (under 30%)`
              : `${utilizationPercent}% of available limit in use`,
      },
      repayment: {
        label: "On-Time Repayment",
        status:
          onTimeRepaymentPercent === null
            ? "UNKNOWN"
            : onTimeRepaymentPercent >= 95
              ? "HEALTHY"
              : onTimeRepaymentPercent >= 80
                ? "WATCH"
                : "AT_RISK",
        detail:
          onTimeRepaymentPercent === null
            ? "No repayment history yet"
            : `${onTimeRepaymentPercent}% of ${totalPayments} payments on time`,
      },
      dti: {
        label: "Debt-to-Income",
        status:
          dtiTier === "LOW" ? "HEALTHY" : dtiTier === "MODERATE" ? "WATCH" : "AT_RISK",
        detail:
          dtiPercent === null
            ? totalMonthlyObligationPKR > 0
              ? "Obligations recorded with no verified income"
              : "No obligations recorded"
            : `${dtiPercent}% of verified income committed`,
      },
    },
  };
}

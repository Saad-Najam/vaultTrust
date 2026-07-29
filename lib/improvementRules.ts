import { ComputedScoreResult } from "./scoring";

// Pre-approved suggestion directions. Gemini (in lib/explain.ts) is only ever
// given the entries matching a weak factor actually present in the score
// data, and is explicitly instructed not to suggest anything outside this
// list — this table is the single source of truth for what can be suggested.
export const IMPROVEMENT_RULES = {
  LOW_DIVERSITY: "diversify income across multiple clients/platforms",
  HIGH_VARIATION: "aim for more consistent monthly inflows",
  DECLINING_TREND: "focus on maintaining/growing active client relationships",
  LOW_INCOME_FOR_BAND: "consider gradually increasing billing rate or client volume",
} as const;

export type WeakFactorKey = keyof typeof IMPROVEMENT_RULES;

// Mirrors the normalization range scoring.ts uses for the income component
// (floor 50k, ceiling 300k) — "low relative to band" means below the midpoint
// of that range, not an arbitrary new number.
const LOW_DIVERSITY_THRESHOLD = 0.3; // largest single source > 70% of income
const HIGH_VARIATION_THRESHOLD = 0.3; // CoV above this counts as inconsistent
const LOW_INCOME_THRESHOLD_PKR = 150000; // midpoint of scoring.ts's 50k-300k range

export function identifyWeakFactors(scoreData: ComputedScoreResult): WeakFactorKey[] {
  const weak: WeakFactorKey[] = [];
  if (scoreData.sourceDiversityScore < LOW_DIVERSITY_THRESHOLD) weak.push("LOW_DIVERSITY");
  if (scoreData.coefficientOfVariation > HIGH_VARIATION_THRESHOLD) weak.push("HIGH_VARIATION");
  if (scoreData.trend === "DECLINING") weak.push("DECLINING_TREND");
  if (scoreData.avgMonthlyIncome < LOW_INCOME_THRESHOLD_PKR) weak.push("LOW_INCOME_FOR_BAND");
  return weak;
}

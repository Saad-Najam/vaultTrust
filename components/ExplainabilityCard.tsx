"use client";

import type { ComputedScoreResult, ScoreBreakdown, ScoreBreakdownFactor } from "@/lib/scoring";

interface ExplainabilityCardProps {
  score: Pick<ComputedScoreResult, "ivs" | "eligibilityBandPKR" | "trend" | "breakdown">;
}

const FACTOR_ORDER: (keyof ScoreBreakdown)[] = ["incomeLevel", "incomeStability", "trend", "clientDiversity"];

function factorSubtitle(
  key: keyof ScoreBreakdown,
  factor: ScoreBreakdownFactor,
  trend: ComputedScoreResult["trend"]
): string {
  // Income Trend reads directly off the actual trend enum (more accurate
  // than re-deriving from the raw 0-100 sub-score, which only has 3 discrete
  // values — 40/70/100 — for GROWING/STABLE/DECLINING anyway).
  if (key === "trend") {
    if (trend === "DECLINING") return "Earnings have been declining over the past 6 months.";
    if (trend === "GROWING") return "Earnings are on a growing trajectory.";
    return "Earnings have remained stable over the past 6 months.";
  }

  const pct = factor.rawScore; // already 0-100

  if (key === "clientDiversity") {
    if (pct < 40) return "High concentration risk — majority of income from a single source.";
    if (pct < 70) return "Moderate diversification across income sources.";
    return "Well-diversified across multiple income sources.";
  }

  if (key === "incomeStability") {
    if (pct < 40) return "High month-to-month volatility increases risk.";
    if (pct < 70) return "Some fluctuation in monthly earnings.";
    return "Consistent, predictable monthly income.";
  }

  // incomeLevel
  if (pct < 40) return "Income is below the threshold most lenders consider stable.";
  if (pct < 70) return "Income is moderate relative to lending bands.";
  return "Strong, well-above-threshold income level.";
}

function barColor(pct: number): string {
  if (pct < 40) return "bg-error";
  if (pct < 70) return "bg-secondary";
  return "bg-primary";
}

function scoreColor(ivs: number): string {
  if (ivs >= 80) return "text-primary";
  if (ivs >= 60) return "text-secondary";
  if (ivs >= 40) return "text-tertiary";
  return "text-error";
}

export default function ExplainabilityCard({ score }: ExplainabilityCardProps) {
  const { breakdown, ivs, eligibilityBandPKR, trend } = score;

  return (
    <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/30 shadow-[0px_4px_20px_rgba(0,0,0,0.04)] p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-headline-sm font-headline-sm text-on-surface">Score Explainability</h3>
          <p className="text-label-sm text-on-surface-variant mt-1">
            Exactly how this score was calculated — no black box.
          </p>
        </div>
        <div className="flex flex-col items-center shrink-0 ml-4">
          <span className={`text-4xl font-bold leading-none ${scoreColor(ivs)}`}>{ivs}</span>
          <span className="text-label-sm text-on-surface-variant mt-1">/ 100</span>
        </div>
      </div>

      <p className="text-label-sm text-on-surface-variant mb-6 pb-4 border-b border-outline-variant/20">
        Eligibility band: <span className="font-semibold text-on-surface">{eligibilityBandPKR}</span>
      </p>

      <div className="space-y-5">
        {FACTOR_ORDER.map((key) => {
          const factor = breakdown[key];
          const pct = factor.maxPoints > 0 ? Math.min(100, (factor.points / factor.maxPoints) * 100) : 0;
          return (
            <div key={key}>
              <div className="flex justify-between items-baseline mb-1.5">
                <span className="text-body-sm font-semibold text-on-surface">{factor.label}</span>
                <span className="text-label-sm font-bold text-on-surface-variant">
                  {factor.points} <span className="opacity-60">/ {factor.maxPoints} pts</span>
                </span>
              </div>
              <div className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${barColor(pct)}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-label-sm text-on-surface-variant mt-1.5">
                {factorSubtitle(key, factor, trend)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

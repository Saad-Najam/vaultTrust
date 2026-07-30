import { dbService } from "./db";
import { computeIncomeScore } from "./scoring";

/**
 * Recomputes and persists the IVS score for a freelancer, using only
 * transactions belonging to currently CONNECTED sources.
 *
 * Shared by every route that changes which sources or transactions exist
 * (link, unlink, sync) so the stored score can never drift from one of them
 * having its own copy of this logic.
 */
export async function recomputeAndPersistScore(uid: string) {
  const allSources = await dbService.listConnectedSources(uid);
  const connectedSourceIds = new Set(
    allSources.filter((s) => s.status === "CONNECTED").map((s) => s.id)
  );
  const allTransactions = await dbService.listTransactions(uid);
  const activeTransactions = allTransactions.filter((tx) =>
    connectedSourceIds.has(tx.sourceId)
  );
  const scores = computeIncomeScore(activeTransactions);

  await dbService.upsertIncomeScore({
    freelancerId: uid,
    avgMonthlyIncome: scores.avgMonthlyIncome,
    coefficientOfVariation: scores.coefficientOfVariation,
    trend: scores.trend,
    sourceDiversityScore: scores.sourceDiversityScore,
    ivs: scores.ivs,
    eligibilityBandPKR: scores.eligibilityBandPKR,
    computedAt: new Date().toISOString(),
  });

  return scores;
}

/** The score fields the connector routes echo back to the client. */
export function toScoreResponse(scores: Awaited<ReturnType<typeof recomputeAndPersistScore>>) {
  return {
    ivs: scores.ivs,
    avgMonthlyIncome: scores.avgMonthlyIncome,
    trend: scores.trend,
    sourceDiversityScore: scores.sourceDiversityScore,
    eligibilityBandPKR: scores.eligibilityBandPKR,
  };
}

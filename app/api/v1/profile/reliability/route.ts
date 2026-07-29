import { NextResponse } from "next/server";
import { dbService } from "@/lib/db";
import { verifyAuthToken } from "@/lib/auth_helper";
import { computeIncomeScore } from "@/lib/scoring";
import { generateScoreExplanation, generateImprovementPlan, ExplanationLanguage } from "@/lib/explain";

export async function GET(request: Request) {
  try {
    const authUser = await verifyAuthToken(request);
    if (!authUser || authUser.role !== "FREELANCER") {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Freelancer role required" },
        { status: 401 }
      );
    }

    const userId = authUser.uid;

    // Fetch user and profile details from the nested schema
    const user = await dbService.getUser(userId);
    const profile = await dbService.getFreelancerProfile(userId);
    const allSources = await dbService.listConnectedSources(userId);
    const transactions = await dbService.listTransactions(userId);

    // Filter transactions to only those belonging to CONNECTED sources
    const connectedSourceIds = new Set(
      allSources.filter((s) => s.status === "CONNECTED").map((s) => s.id)
    );
    const activeTransactions = transactions.filter((t) =>
      connectedSourceIds.has(t.sourceId)
    );

    // Compute IVS using scoring engine
    const scores = computeIncomeScore(activeTransactions);

    // Optional narration layer — purely additive, never alters `scores` above.
    // Run in parallel: each call has its own timeout/fallback, so there's no
    // reason to make the second one wait on the first.
    const { searchParams } = new URL(request.url);
    const language: ExplanationLanguage = searchParams.get("lang") === "roman-urdu" ? "roman-urdu" : "en";
    const [explanation, improvementPlan] = await Promise.all([
      generateScoreExplanation(scores, language),
      generateImprovementPlan(scores, language),
    ]);

    // Save score record to DB
    const scoreRecord = {
      freelancerId: userId,
      avgMonthlyIncome: scores.avgMonthlyIncome,
      coefficientOfVariation: scores.coefficientOfVariation,
      trend: scores.trend,
      sourceDiversityScore: scores.sourceDiversityScore,
      ivs: scores.ivs,
      eligibilityBandPKR: scores.eligibilityBandPKR,
      computedAt: new Date().toISOString(),
    };
    await dbService.upsertIncomeScore(scoreRecord);

    // Calculate individual components for UI breakdown (represented out of 100)
    // Component A: Income Level (Normalized 50k to 300k PKR)
    const incomeScoreRaw = scores.avgMonthlyIncome <= 50000
      ? 0
      : scores.avgMonthlyIncome >= 300000
        ? 100
        : ((scores.avgMonthlyIncome - 50000) / (300000 - 50000)) * 100;

    // Component B: Consistency (inverse of CoV)
    const consistencyScoreRaw = Math.max(0, Math.min(100, (1 - scores.coefficientOfVariation) * 100));

    // Component C: Trend
    const trendScoreRaw = scores.trend === "GROWING" ? 100 : scores.trend === "STABLE" ? 70 : 40;

    // Component D: Diversity
    const diversityScoreRaw = scores.sourceDiversityScore * 100;

    return NextResponse.json({
      success: true,
      userId,
      userName: user?.name || "Freelancer",
      city: profile?.city || "Pakistan",
      scores: {
        ...scores,
        incomeScore: Math.round(incomeScoreRaw),
        consistencyScore: Math.round(consistencyScoreRaw),
        trendScore: Math.round(trendScoreRaw),
        diversityScore: Math.round(diversityScoreRaw),
      },
      explanation,
      ...(improvementPlan
        ? {
            improvementSuggestions: improvementPlan.suggestions,
            improvementDisclaimer: improvementPlan.disclaimer,
          }
        : {}),
    });
  } catch (error: any) {
    console.error("Profile reliability API endpoint error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

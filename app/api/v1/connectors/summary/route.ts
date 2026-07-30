import { NextResponse } from "next/server";
import { dbService } from "@/lib/db";
import { verifyAuthToken } from "@/lib/auth_helper";
import { normalizeAmountToPKR } from "@/lib/scoring";
import { PLATFORMS, Platform, zeroByPlatform } from "@/lib/platforms";

/**
 * GET /api/v1/connectors/summary
 * Returns a full aggregated summary for the authenticated freelancer:
 * - All connected sources with status
 * - Recent transactions (last 10 across all CONNECTED sources)
 * - 6-month monthly aggregates broken down by source type (in PKR)
 * - Source mix percentages (PAYONEER / BANK_TRANSFER / LOCAL_INVOICING)
 * - Current IVS score and eligibility band
 */
export async function GET(request: Request) {
  try {
    const authUser = await verifyAuthToken(request);
    if (!authUser || authUser.role !== "FREELANCER") {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Freelancer token required" },
        { status: 401 }
      );
    }

    const userId = authUser.uid;

    // Fetch connected sources, transactions, and persisted income score in parallel
    const [allSources, transactions, incomeScore] = await Promise.all([
      dbService.listConnectedSources(userId),
      dbService.listTransactions(userId),
      dbService.getIncomeScore(userId),
    ]);

    // Filter transactions to only those belonging to CONNECTED sources
    const connectedSourceIds = new Set(
      allSources.filter((s) => s.status === "CONNECTED").map((s) => s.id)
    );
    const platformBySourceId = new Map(allSources.map((s) => [s.id, s.platform]));
    const activeTransactions = transactions.filter((t) =>
      connectedSourceIds.has(t.sourceId)
    );

    // Sort transactions by date descending for the recent list
    const recentTransactions = [...activeTransactions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10); // Limit to latest 10

    // Build 6-month monthly aggregate buckets (oldest → current)
    const now = new Date();
    const monthlyAggregates = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 15);
      return {
        monthLabel: d.toLocaleString("default", { month: "short" }).toUpperCase(),
        year: d.getFullYear(),
        month: d.getMonth(),
        totalPKR: 0,
        byPlatform: zeroByPlatform(),
      };
    });

    activeTransactions.forEach((tx) => {
      const txDate = new Date(tx.date);
      const txYear = txDate.getFullYear();
      const txMonth = txDate.getMonth();
      const amountPKR = normalizeAmountToPKR(tx.amount, tx.currency);

      const monthIdx = monthlyAggregates.findIndex(
        (m) => m.year === txYear && m.month === txMonth
      );

      if (monthIdx >= 0 && monthIdx < 6) {
        monthlyAggregates[monthIdx].totalPKR += amountPKR;

        const platform = platformBySourceId.get(tx.sourceId);
        if (platform) {
          monthlyAggregates[monthIdx].byPlatform[platform] += amountPKR;
        }
      }
    });

    // Source mix percentages, normalized to PKR across all 6 months. Keyed by
    // platform so a new provider needs no change here or in the consumers.
    const platformTotals = zeroByPlatform();
    let totalAllMonthsPKR = 0;

    monthlyAggregates.forEach((m) => {
      totalAllMonthsPKR += m.totalPKR;
      PLATFORMS.forEach((p) => {
        platformTotals[p] += m.byPlatform[p];
      });
    });

    const sourceMix = PLATFORMS.reduce(
      (acc, p) => ({
        ...acc,
        [p]:
          totalAllMonthsPKR > 0
            ? Math.round((platformTotals[p] / totalAllMonthsPKR) * 100)
            : 0,
      }),
      {} as Record<Platform, number>
    );

    const currentMonthAgg = monthlyAggregates[5]; // Most recent month bucket
    const totalTransactions = activeTransactions.length;

    // Per-source record counts, so each card can show its own real total
    // instead of a hardcoded figure. Counted over all transactions (not just
    // CONNECTED ones) so a disconnected source still reports retained data.
    const countBySourceId = new Map<string, number>();
    transactions.forEach((t) => {
      countBySourceId.set(t.sourceId, (countBySourceId.get(t.sourceId) || 0) + 1);
    });

    // Distinct payers across connected sources — replaces what used to be a
    // decorative "+21" badge on the connect page with a real figure.
    const distinctClientCount = new Set(
      activeTransactions.map((t) => t.clientLabel).filter(Boolean)
    ).size;

    return NextResponse.json({
      success: true,
      userId,
      connectedSources: allSources.map((s) => ({
        ...s,
        transactionCount: countBySourceId.get(s.id) || 0,
      })),
      recentTransactions,
      monthlyAggregates: monthlyAggregates.map((m) => ({
        ...m,
        totalPKR: Math.round(m.totalPKR),
        byPlatform: PLATFORMS.reduce(
          (acc, p) => ({ ...acc, [p]: Math.round(m.byPlatform[p]) }),
          {} as Record<Platform, number>
        ),
      })),
      sourceMix,
      incomeScore: incomeScore
        ? {
            ivs: incomeScore.ivs,
            avgMonthlyIncome: incomeScore.avgMonthlyIncome,
            trend: incomeScore.trend,
            sourceDiversityScore: incomeScore.sourceDiversityScore,
            eligibilityBandPKR: incomeScore.eligibilityBandPKR,
            computedAt: incomeScore.computedAt,
          }
        : null,
      currentMonthTotalPKR: currentMonthAgg
        ? Math.round(currentMonthAgg.totalPKR)
        : 0,
      totalTransactions,
      distinctClientCount,
    });
  } catch (error: any) {
    console.error("[Summary GET] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

import { NextResponse, after } from "next/server";
import { dbService } from "@/lib/db";
import { verifyAuthToken } from "@/lib/auth_helper";
import { computeIncomeScore, computeSpendCreditMetrics } from "@/lib/scoring";
import { assessEligibility, resolveDisclosure, cappedOfferPKR } from "@/lib/eligibility";
import type { ApplicantDetailResponse } from "@/lib/api_types";
import { appendLedgerEntry } from "@/lib/ledger";
import { isRateLimited } from "@/lib/rate_limiter";
import { logBankAccess as logBankAccessOnChain } from "@/lib/blockchain/client/consent-client";
import { getErrorMessage } from "@/lib/errors";

export async function GET(request: Request) {
  try {
    const authUser = await verifyAuthToken(request);
    if (!authUser || authUser.role !== "BANK_OFFICER") {
      return NextResponse.json(
        { success: false, error: "Access Denied: Bank Officer credentials required." },
        { status: 403 }
      );
    }

    const bankId = authUser.uid;

    // Rate Limiting: 10 bank assessment requests per minute
    if (isRateLimited(bankId, 10, 60 * 1000)) {
      return NextResponse.json(
        { success: false, error: "Too many assessment requests. Please wait." },
        { status: 429 }
      );
    }

    const { searchParams } = new URL(request.url);
    const freelancerId = searchParams.get("freelancerId");
    const includeRaw = searchParams.get("includeRawTransactions") === "true";

    // CASE 1: Retrieve details for a single freelancer
    if (freelancerId) {
      // 1. Verify that an ACTIVE consent exists naming this bankId
      const activeConsent = await dbService.getActiveConsent(freelancerId, bankId);

      if (!activeConsent || activeConsent.status !== "ACTIVE") {
        return NextResponse.json(
          {
            success: false,
            error: "Access Denied: No active consent exists for this bank.",
          },
          { status: 403 }
        );
      }

      // 2. Fetch freelancer details from nested collections
      const user = await dbService.getUser(freelancerId);
      const profile = await dbService.getFreelancerProfile(freelancerId);
      const allSources = await dbService.listConnectedSources(freelancerId);
      const transactions = await dbService.listTransactions(freelancerId);

      // Filter transactions based on consented sources
      const consentedPlatforms = new Set(activeConsent.sources);
      const consentedSourceIds = new Set(
        allSources
          .filter((s) => s.status === "CONNECTED" && consentedPlatforms.has(s.platform))
          .map((s) => s.id)
      );

      const consentedTransactions = transactions.filter((t) =>
        consentedSourceIds.has(t.sourceId)
      );

      // 3. Compute score metrics
      const scores = computeIncomeScore(consentedTransactions);

      // 3b. Outflow / DTI. Cards are only ever read when CREDIT_CARD is in the
      // consent — the bank sees the disclosure *status* either way, but the
      // underlying figures only when they were actually shared.
      const outflowConsented = consentedPlatforms.has("CREDIT_CARD");
      const linkedCards = outflowConsented
        ? (await dbService.listCreditCards(freelancerId)).filter((c) =>
            allSources.some(
              (s) => s.id === c.sourceId && s.status === "CONNECTED"
            )
          )
        : [];
      const spendCredit = outflowConsented
        ? computeSpendCreditMetrics(linkedCards, scores.avgMonthlyIncome)
        : null;

      const disclosure = resolveDisclosure({
        consentSources: activeConsent.sources,
        hasLinkedCards: linkedCards.length > 0,
      });
      const eligibility = assessEligibility({
        ivs: scores.ivs,
        disclosure,
        dtiTier: spendCredit?.dtiTier ?? null,
      });

      // 4. Dual-write access logging (ledger + best-effort blockchain), scheduled
      // via `after()` so it never delays this response — dashboard load time
      // must not depend on ledger/blockchain write latency.
      const accessedAt = new Date().toISOString();
      const clientIp = request.headers.get("x-forwarded-for") || "unknown";

      after(async () => {
        // Guaranteed write — independent of blockchain availability.
        try {
          await appendLedgerEntry(activeConsent.id, "BANK_ACCESS", {
            bankId,
            accessedAt,
            accessedFields: [
              "avgMonthlyIncome",
              "coefficientOfVariation",
              "trend",
              "ivs",
              ...(outflowConsented ? ["dtiPercent", "creditUtilization"] : []),
            ],
          });
        } catch (ledgerError) {
          console.error("[BANK_ACCESS LEDGER WRITE FAILED]", { consentId: activeConsent.id, ledgerError });
        }

        // Best-effort dual-write to Solana devnet.
        let chainResult: { signature?: string; bankWallet?: string } = {};
        try {
          const onChain = await logBankAccessOnChain({
            freelancerUid: freelancerId,
            bankUid: bankId,
          });
          chainResult = { signature: onChain.signature, bankWallet: onChain.bankWallet };
          await dbService.updateConsent(activeConsent.id, {
            blockchainStatus: "CONFIRMED",
            solanaTxSignature: onChain.signature,
          });
        } catch (chainError) {
          console.error("[BLOCKCHAIN WRITE FAILED - log_bank_access]", {
            consentId: activeConsent.id,
            error: getErrorMessage(chainError),
          });
          try {
            await dbService.updateConsent(activeConsent.id, {
              blockchainStatus: "FAILED",
              blockchainError: getErrorMessage(chainError),
            });
          } catch (statusUpdateError) {
            console.error("[FAILED TO RECORD BLOCKCHAIN FAILURE STATUS]", {
              consentId: activeConsent.id,
              statusUpdateError,
            });
          }
        }

        // Structured operational audit log — Consent ID, Bank ID, Timestamp,
        // Wallet, Transaction Signature (if available).
        console.log(
          "[AUDIT LOG - BANK_ACCESS]",
          JSON.stringify({
            consentId: activeConsent.id,
            bankId,
            freelancerId,
            timestamp: accessedAt,
            bankWallet: chainResult.bankWallet || null,
            solanaTxSignature: chainResult.signature || null,
            ip: clientIp,
          })
        );
      });

      // 6. Data minimization response payload
      const responsePayload: ApplicantDetailResponse = {
        success: true,
        freelancerId,
        name: user?.name || "Freelancer",
        city: profile?.city || "Unknown",
        consentInfo: {
          consentId: activeConsent.id,
          grantedAt: activeConsent.grantedAt,
          sourcesShared: activeConsent.sources,
          scope: activeConsent.scope,
          duration: activeConsent.duration,
        },
        incomeProfile: {
          avgMonthlyIncome: scores.avgMonthlyIncome,
          coefficientOfVariation: scores.coefficientOfVariation,
          trend: scores.trend,
          sourceDiversityScore: scores.sourceDiversityScore,
          ivs: scores.ivs,
          // Indicative, income-only band. `eligibility` below is authoritative:
          // it is the one that accounts for disclosure and debt.
          indicativeIncomeOnlyBandPKR: scores.eligibilityBandPKR,
          breakdown: scores.breakdown,
        },
        // Authoritative decision surface for the lending team.
        eligibility,
        // Always present so a withheld disclosure reads as an explicit signal
        // rather than a missing field.
        outflowDisclosure: {
          status: disclosure,
          shared: outflowConsented,
          metrics: spendCredit
            ? {
                dtiPercent: spendCredit.dtiPercent,
                dtiTier: spendCredit.dtiTier,
                utilizationPercent: spendCredit.utilizationPercent,
                onTimeRepaymentPercent: spendCredit.onTimeRepaymentPercent,
                netFreeCashFlowPKR: spendCredit.netFreeCashFlowPKR,
                totalMonthlyObligationPKR: spendCredit.totalMonthlyObligationPKR,
                cardCount: spendCredit.cardCount,
                badges: spendCredit.badges,
              }
            : null,
          recommendedOfferPKR: spendCredit
            ? cappedOfferPKR(spendCredit.recommendedCreditLimitPKR, eligibility)
            : 0,
        },
      };

      if (includeRaw) {
        responsePayload.rawTransactions = consentedTransactions;
      }

      return NextResponse.json(responsePayload);
    }

    // CASE 2: List all freelancers for the bank lending team
    const allUsers = await dbService.listUsers();
    const freelancers = allUsers.filter((u) => u.role === "FREELANCER");
    
    const results = [];
    for (const freelancer of freelancers) {
      const activeConsent = await dbService.getActiveConsent(freelancer.id, bankId);
      const profile = await dbService.getFreelancerProfile(freelancer.id);
      
      let avgIncome = 0;
      let ivs = 0;
      let trend: "GROWING" | "STABLE" | "DECLINING" = "STABLE";
      let eligibility = null as ReturnType<typeof assessEligibility> | null;

      // If active consent exists, compute summary stats
      if (activeConsent) {
        const allSources = await dbService.listConnectedSources(freelancer.id);
        const transactions = await dbService.listTransactions(freelancer.id);
        const consentedPlatforms = new Set(activeConsent.sources);
        const consentedSourceIds = new Set(
          allSources
            .filter((s) => s.status === "CONNECTED" && consentedPlatforms.has(s.platform))
            .map((s) => s.id)
        );
        const consentedTransactions = transactions.filter((t) =>
          consentedSourceIds.has(t.sourceId)
        );
        const scores = computeIncomeScore(consentedTransactions);
        avgIncome = scores.avgMonthlyIncome;
        ivs = scores.ivs;
        trend = scores.trend;

        // Same gating as the detail view so the list cannot rank an applicant
        // above the tier their disclosure actually supports.
        const outflowConsented = consentedPlatforms.has("CREDIT_CARD");
        const linkedCards = outflowConsented
          ? (await dbService.listCreditCards(freelancer.id)).filter((c) =>
              allSources.some(
                (s) => s.id === c.sourceId && s.status === "CONNECTED"
              )
            )
          : [];
        const spend = outflowConsented
          ? computeSpendCreditMetrics(linkedCards, scores.avgMonthlyIncome)
          : null;
        eligibility = assessEligibility({
          ivs: scores.ivs,
          disclosure: resolveDisclosure({
            consentSources: activeConsent.sources,
            hasLinkedCards: linkedCards.length > 0,
          }),
          dtiTier: spend?.dtiTier ?? null,
        });
      }

      results.push({
        id: freelancer.id,
        name: freelancer.name,
        email: freelancer.email,
        city: profile?.city || "Unknown",
        consentStatus: activeConsent ? "ACTIVE" : "NONE",
        consentId: activeConsent?.id || null,
        grantedAt: activeConsent?.grantedAt || null,
        avgMonthlyIncome: avgIncome,
        ivs,
        trend,
        eligibilityTier: eligibility?.tier || null,
        eligibilityLabel: eligibility?.label || null,
        outflowDisclosure: eligibility?.disclosure || null,
        eligibilityCapped: eligibility?.capped ?? false,
      });
    }

    return NextResponse.json({
      success: true,
      applicants: results,
    });
  } catch (error) {
    console.error("Lending assess API endpoint error:", error);
    return NextResponse.json(
      { success: false, error: getErrorMessage(error, "Internal Server Error") },
      { status: 500 }
    );
  }
}

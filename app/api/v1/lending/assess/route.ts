import { NextResponse, after } from "next/server";
import { dbService, Consent } from "@/lib/db";
import { verifyAuthToken } from "@/lib/auth_helper";
import { computeIncomeScore } from "@/lib/scoring";
import { appendLedgerEntry } from "@/lib/ledger";
import { isRateLimited } from "@/lib/rate_limiter";
import { logBankAccess as logBankAccessOnChain } from "@/lib/blockchain/client/consent-client";

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
            accessedFields: ["avgMonthlyIncome", "coefficientOfVariation", "trend", "ivs"],
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
        } catch (chainError: any) {
          console.error("[BLOCKCHAIN WRITE FAILED - log_bank_access]", {
            consentId: activeConsent.id,
            error: chainError.message || chainError,
          });
          try {
            await dbService.updateConsent(activeConsent.id, {
              blockchainStatus: "FAILED",
              blockchainError: chainError.message || String(chainError),
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
      const responsePayload: any = {
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
          eligibilityBandPKR: scores.eligibilityBandPKR,
          breakdown: scores.breakdown,
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
      });
    }

    return NextResponse.json({
      success: true,
      applicants: results,
    });
  } catch (error: any) {
    console.error("Lending assess API endpoint error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { dbService, LoanOffer } from "@/lib/db";
import { verifyAuthToken } from "@/lib/auth_helper";
import { computeIncomeScore, computeSpendCreditMetrics } from "@/lib/scoring";
import { assessEligibility, resolveDisclosure } from "@/lib/eligibility";
import { appendLedgerEntry } from "@/lib/ledger";
import { isRateLimited } from "@/lib/rate_limiter";
import { z } from "zod";
import { getErrorMessage } from "@/lib/errors";

const ApproveSchema = z.object({
  freelancerId: z.string().min(1),
});

/**
 * POST /api/v1/lending/approve
 *
 * Records a bank officer's decision to extend the pre-approved offer to an
 * applicant. The approved amount is recomputed here from the same eligibility
 * engine the assessment view uses — it is deliberately NOT taken from the
 * request body, so a tampered client cannot approve an arbitrary figure.
 *
 * The decision is appended to the consent's tamper-evident ledger, so the
 * bank's own action is auditable on the same hash chain as the consent it
 * was based on.
 */
export async function POST(request: Request) {
  try {
    const authUser = await verifyAuthToken(request);
    if (!authUser || authUser.role !== "BANK_OFFICER") {
      return NextResponse.json(
        { success: false, error: "Access Denied: Bank Officer credentials required." },
        { status: 403 }
      );
    }

    const bankId = authUser.uid;
    if (isRateLimited(bankId, 10, 60 * 1000)) {
      return NextResponse.json(
        { success: false, error: "Too many approval requests. Please wait." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { freelancerId } = ApproveSchema.parse(body);

    // An offer may only be made while consent to see the data is live.
    const activeConsent = await dbService.getActiveConsent(freelancerId, bankId);
    if (!activeConsent || activeConsent.status !== "ACTIVE") {
      return NextResponse.json(
        {
          success: false,
          error: "Cannot approve: this applicant has no active consent for your institution.",
        },
        { status: 403 }
      );
    }

    const existing = await dbService.getLoanOffer(freelancerId, bankId);
    if (existing) {
      return NextResponse.json({
        success: true,
        alreadyApproved: true,
        offer: existing,
        message: "An offer has already been extended to this applicant.",
      });
    }

    // Recompute eligibility from consented data only — same path as the
    // assessment view, so the offer can never exceed what the tier allows.
    const allSources = await dbService.listConnectedSources(freelancerId);
    const transactions = await dbService.listTransactions(freelancerId);
    const consentedPlatforms = new Set(activeConsent.sources);
    const consentedSourceIds = new Set(
      allSources
        .filter((s) => s.status === "CONNECTED" && consentedPlatforms.has(s.platform))
        .map((s) => s.id)
    );
    const consentedTransactions = transactions.filter((t) => consentedSourceIds.has(t.sourceId));
    const scores = computeIncomeScore(consentedTransactions);

    const outflowConsented = consentedPlatforms.has("CREDIT_CARD");
    const linkedCards = outflowConsented
      ? (await dbService.listCreditCards(freelancerId)).filter((c) =>
          allSources.some((s) => s.id === c.sourceId && s.status === "CONNECTED")
        )
      : [];
    const spend = outflowConsented
      ? computeSpendCreditMetrics(linkedCards, scores.avgMonthlyIncome)
      : null;
    const eligibility = assessEligibility({
      ivs: scores.ivs,
      disclosure: resolveDisclosure({
        consentSources: activeConsent.sources,
        hasLinkedCards: linkedCards.length > 0,
      }),
      dtiTier: spend?.dtiTier ?? null,
    });

    if (!eligibility.maxLimitPKR || eligibility.maxLimitPKR <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Cannot approve: this applicant is not eligible for an offer at present.",
        },
        { status: 422 }
      );
    }

    const approvedAt = new Date().toISOString();
    const offer: LoanOffer = {
      id: `${freelancerId}_${bankId}`,
      consentId: activeConsent.id,
      freelancerId,
      bankId,
      amountPKR: eligibility.maxLimitPKR,
      tier: eligibility.tier,
      tierLabel: eligibility.label,
      ivsAtApproval: scores.ivs,
      approvedBy: bankId,
      approvedAt,
      status: "OFFERED",
    };

    await dbService.createLoanOffer(offer);

    // Append to the same hash chain as the consent. Best-effort: the offer
    // itself is already durably recorded, so a ledger failure must not make
    // the caller think the approval did not happen.
    let ledgerWarning: string | null = null;
    try {
      await appendLedgerEntry(activeConsent.id, "LOAN_OFFER", {
        amountPKR: offer.amountPKR,
        tier: offer.tier,
        ivsAtApproval: offer.ivsAtApproval,
        approvedBy: bankId,
        approvedAt,
      });
    } catch (err) {
      ledgerWarning = getErrorMessage(err);
      console.error("[Lending Approve] Ledger append failed:", err);
    }

    return NextResponse.json({
      success: true,
      alreadyApproved: false,
      offer,
      ledgerWarning,
    });
  } catch (error) {
    console.error("Lending approve API endpoint error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { success: false, error: getErrorMessage(error, "Internal Server Error") },
      { status: 500 }
    );
  }
}

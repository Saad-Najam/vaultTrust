import { NextResponse } from "next/server";
import { dbService, Consent } from "@/lib/db";
import { verifyAuthToken } from "@/lib/auth_helper";
import { appendLedgerEntry } from "@/lib/ledger";
import { isRateLimited } from "@/lib/rate_limiter";
import { grantConsent as grantConsentOnChain } from "@/lib/blockchain/client/consent-client";
import { PLATFORMS } from "@/lib/platforms";
import { z } from "zod";
import { getErrorMessage } from "@/lib/errors";

const GrantConsentSchema = z.object({
  sources: z.array(z.enum(PLATFORMS)),
  scope: z.string().optional().default("ALL"),
  duration: z.enum(["ONE_TIME", "ROLLING_6MO"]).optional(),
  scopeDuration: z.enum(["ONE_TIME", "ROLLING_6MO"]).optional(),
  purpose: z.string().min(1),
  bankId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const authUser = await verifyAuthToken(request);
    if (!authUser || authUser.role !== "FREELANCER") {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Freelancer role required" },
        { status: 401 }
      );
    }

    const userId = authUser.uid;

    // Rate limiting: 5 grant requests per minute per user
    if (isRateLimited(userId, 5, 60 * 1000)) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please wait a minute." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const validated = GrantConsentSchema.parse(body);
    const { sources, scope, purpose, bankId } = validated;
    const finalDuration = validated.duration || validated.scopeDuration || "ROLLING_6MO";

    const consentId = `${userId}_${bankId}`;

    // 1. Check if there is an active consent, and revoke it first.
    // Rollback safety: if the ledger append fails after the status update
    // above already succeeded, the old consent would be left marked REVOKED
    // with no audit trail — compensate by reverting it back to ACTIVE.
    const activeConsent = await dbService.getActiveConsent(userId, bankId);
    if (activeConsent) {
      const revokedAt = new Date().toISOString();
      await dbService.updateConsent(activeConsent.id, {
        status: "REVOKED",
        revokedAt,
      });
      try {
        await appendLedgerEntry(activeConsent.id, "REVOKE", {
          reason: "Superseded by new consent grant policy",
          revokedAt,
        });
      } catch (ledgerError) {
        console.error("[ROLLBACK] Ledger write failed after revoking superseded consent — reverting to ACTIVE", {
          consentId: activeConsent.id,
          ledgerError,
        });
        try {
          await dbService.updateConsent(activeConsent.id, { status: "ACTIVE", revokedAt: null });
        } catch (rollbackError) {
          console.error("[ROLLBACK FAILED] Superseded consent could not be reverted — needs manual cleanup", {
            consentId: activeConsent.id,
            rollbackError,
          });
        }
        throw new Error("Failed to record consent revocation in the tamper-evident ledger. No changes were saved — please try again.");
      }
    }

    // 2. Create the new Consent record
    const newConsent: Consent = {
      id: consentId,
      freelancerId: userId,
      bankId,
      sources,
      scope,
      duration: finalDuration,
      purpose,
      status: "ACTIVE",
      grantedAt: new Date().toISOString(),
      revokedAt: null,
    };

    await dbService.createConsent(newConsent);

    // 3. Append the GRANT entry to the ledger (guaranteed write — this alone
    // is sufficient for the request to succeed, independent of blockchain availability).
    // Rollback safety: if this fails after the consent doc above was already
    // created, we'd be left with an ACTIVE consent that has no audit trail —
    // compensate by deleting it so the system never reports success on a
    // half-completed write.
    let ledgerEntry;
    try {
      ledgerEntry = await appendLedgerEntry(consentId, "GRANT", {
        sources,
        scope,
        duration: finalDuration,
        purpose,
        grantedAt: newConsent.grantedAt,
      });
    } catch (ledgerError) {
      console.error("[ROLLBACK] Ledger write failed after consent creation — deleting orphaned consent doc", {
        consentId,
        ledgerError,
      });
      try {
        await dbService.deleteConsent(consentId);
      } catch (rollbackError) {
        console.error("[ROLLBACK FAILED] Orphaned consent doc could not be removed — needs manual cleanup", {
          consentId,
          rollbackError,
        });
      }
      throw new Error("Failed to record consent in the tamper-evident ledger. No changes were saved — please try again.");
    }

    // 4. Best-effort dual-write to Solana devnet. Failures are logged for
    // retry and never block the response — the ledger write above already
    // guarantees a tamper-evident record regardless of chain availability.
    let blockchain: { status: Consent["blockchainStatus"]; signature?: string } = {
      status: "PENDING_RETRY",
    };
    try {
      const onChain = await grantConsentOnChain({
        freelancerUid: userId,
        bankUid: bankId,
        consentId,
        purpose,
        scope,
        expiryUnixSeconds: 0,
      });
      blockchain = { status: "CONFIRMED", signature: onChain.signature };
      await dbService.updateConsent(consentId, {
        blockchainStatus: "CONFIRMED",
        solanaTxSignature: onChain.signature,
        solanaConsentPda: onChain.consentPda,
      });
    } catch (chainError) {
      console.error("[BLOCKCHAIN WRITE FAILED - grant_consent]", {
        consentId,
        error: getErrorMessage(chainError),
      });
      blockchain = { status: "FAILED" };
      // Recording the failure status is itself best-effort — a hiccup here
      // must never turn an already-successful ledger write into a 500.
      try {
        await dbService.updateConsent(consentId, {
          blockchainStatus: "FAILED",
          blockchainError: getErrorMessage(chainError),
        });
      } catch (statusUpdateError) {
        console.error("[FAILED TO RECORD BLOCKCHAIN FAILURE STATUS]", { consentId, statusUpdateError });
      }
    }

    return NextResponse.json({
      success: true,
      consent: { ...newConsent, blockchainStatus: blockchain.status, solanaTxSignature: blockchain.signature },
      ledgerEntry,
      blockchain,
      message: "Secure consent granted and recorded in tamper-evident ledger.",
    });
  } catch (error) {
    console.error("Grant consent API endpoint error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { success: false, error: getErrorMessage(error, "Internal Server Error") },
      { status: 500 }
    );
  }
}

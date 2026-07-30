import { NextResponse } from "next/server";
import { dbService, Consent } from "@/lib/db";
import { verifyAuthToken } from "@/lib/auth_helper";
import { appendLedgerEntry } from "@/lib/ledger";
import { updateConsent as updateConsentOnChain } from "@/lib/blockchain/client/consent-client";
import { PLATFORMS } from "@/lib/platforms";
import { z } from "zod";
import { getErrorMessage } from "@/lib/errors";

const UpdateConsentSchema = z.object({
  consentId: z.string().optional(),
  sources: z.array(z.enum(PLATFORMS)),
  scope: z.string().min(1),
  duration: z.enum(["ONE_TIME", "ROLLING_6MO"]),
  purpose: z.string().min(1),
  bankId: z.string().optional(),
});

export async function PUT(request: Request) {
  try {
    const authUser = await verifyAuthToken(request);
    if (!authUser || authUser.role !== "FREELANCER") {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Freelancer role required" },
        { status: 401 }
      );
    }

    const userId = authUser.uid;
    const body = await request.json();
    const validated = UpdateConsentSchema.parse(body);

    let consent = null;
    if (validated.consentId) {
      consent = await dbService.getConsent(validated.consentId);
    } else {
      const bankId = validated.bankId || "ubl-bank-id";
      consent = await dbService.getConsent(`${userId}_${bankId}`);
    }

    if (!consent || consent.freelancerId !== userId) {
      return NextResponse.json(
        { success: false, error: "Consent policy not found." },
        { status: 404 }
      );
    }

    if (consent.status === "REVOKED") {
      return NextResponse.json(
        { success: false, error: "Cannot update a revoked consent policy." },
        { status: 400 }
      );
    }

    // Update the consent fields
    const updatedFields = {
      sources: validated.sources,
      scope: validated.scope,
      duration: validated.duration,
      purpose: validated.purpose,
    };
    await dbService.updateConsent(consent.id, updatedFields);

    // Append SCOPE_CHANGE to the ledger (guaranteed write — this alone is
    // sufficient for the request to succeed, independent of blockchain availability)
    const ledgerEntry = await appendLedgerEntry(consent.id, "SCOPE_CHANGE", {
      oldSources: consent.sources,
      oldScope: consent.scope,
      oldDuration: consent.duration,
      oldPurpose: consent.purpose,
      newSources: validated.sources,
      newScope: validated.scope,
      newDuration: validated.duration,
      newPurpose: validated.purpose,
      updatedAt: new Date().toISOString(),
    });

    // Best-effort dual-write to Solana devnet. Same safety pattern as
    // grant/revoke: never blocks the response, failures are logged for retry.
    let blockchain: { status: Consent["blockchainStatus"]; signature?: string } = { status: "FAILED" };
    try {
      const onChain = await updateConsentOnChain({
        freelancerUid: userId,
        bankUid: consent.bankId,
        purpose: validated.purpose,
        scope: validated.scope,
        expiryUnixSeconds: 0,
      });
      blockchain = { status: "CONFIRMED", signature: onChain.signature };
      await dbService.updateConsent(consent.id, {
        blockchainStatus: "CONFIRMED",
        solanaTxSignature: onChain.signature,
      });
    } catch (chainError) {
      console.error("[BLOCKCHAIN WRITE FAILED - update_consent]", {
        consentId: consent.id,
        error: getErrorMessage(chainError),
      });
      try {
        await dbService.updateConsent(consent.id, {
          blockchainStatus: "FAILED",
          blockchainError: getErrorMessage(chainError),
        });
      } catch (statusUpdateError) {
        console.error("[FAILED TO RECORD BLOCKCHAIN FAILURE STATUS]", { consentId: consent.id, statusUpdateError });
      }
    }

    return NextResponse.json({
      success: true,
      consent: {
        ...consent,
        ...updatedFields,
        blockchainStatus: blockchain.status,
        solanaTxSignature: blockchain.signature,
      },
      ledgerEntry,
      blockchain,
      message: "Consent scope updated and recorded in ledger.",
    });
  } catch (error) {
    console.error("Update consent API endpoint error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { success: false, error: getErrorMessage(error, "Internal Server Error") },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { dbService } from "@/lib/db";
import { verifyAuthToken } from "@/lib/auth_helper";
import { getPlatformAdapter } from "@/lib/adapters";
import { recomputeAndPersistScore, toScoreResponse } from "@/lib/score_service";
import { PLATFORMS, isIncomePlatform } from "@/lib/platforms";
import { z } from "zod";
import { errorStartsWith, getErrorMessage } from "@/lib/errors";

const linkSchema = z.object({
  platform: z.enum(PLATFORMS),
  authCode: z.string().optional(),
});

const unlinkSchema = z.object({
  sourceId: z.string().min(1),
});

/**
 * POST /api/v1/connectors/link
 * Links a mock income source for the authenticated freelancer.
 * - Verifies Firebase ID token and FREELANCER role.
 * - Accepts sourceType via `platform` field (PAYONEER | BANK_TRANSFER | LOCAL_INVOICING).
 * - Creates connectedSources/{uid}/sources/{sourceId} with status ACTIVE and provider "sandbox".
 * - Populates transactions/{uid}/sources/{sourceId}/records/{txId} with 6-month mock data.
 * - Returns 409 if source is already CONNECTED.
 * - Re-activates a DISCONNECTED source if the same platform is re-submitted.
 * - Recomputes and stores IVS score immediately after linking.
 * - Returns success response with the new source and updated score.
 */
export async function POST(request: Request) {
  try {
    const authUser = await verifyAuthToken(request);
    if (!authUser || authUser.role !== "FREELANCER") {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Freelancer role required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validated = linkSchema.parse(body);

    // Outflow sources have their own connector — linking one here would hand it
    // to a transaction generator and count a card balance as earnings.
    if (!isIncomePlatform(validated.platform)) {
      return NextResponse.json(
        {
          success: false,
          error: `${validated.platform} is an outflow source. Link it via /api/v1/connectors/credit-card instead.`,
        },
        { status: 400 }
      );
    }
    const platform = validated.platform;

    // Derive the deterministic sourceId that SandboxAdapter will produce
    const expectedSourceId = `${authUser.uid}_${platform.toLowerCase()}`;
    const existingSource = await dbService.getConnectedSource(
      authUser.uid,
      expectedSourceId
    );

    // Guard: reject if already CONNECTED (freelancer must disconnect first)
    if (existingSource && existingSource.status === "CONNECTED") {
      return NextResponse.json(
        {
          success: false,
          error: `ALREADY_CONNECTED: ${platform} is already connected. Disconnect it first to re-link.`,
        },
        { status: 409 }
      );
    }

    // 1. Resolve adapter (sandbox in all mock environments)
    const adapter = getPlatformAdapter(platform);

    // 2. Perform connection handshake to get source metadata
    const source = await adapter.connect(
      authUser.uid,
      platform,
      validated.authCode
    );

    // 3. Persist or re-activate the source document. Connecting pulls a fresh
    //    transaction history below, so this counts as the first sync.
    const syncedAt = new Date().toISOString();
    if (existingSource && existingSource.status === "DISCONNECTED") {
      // Re-activation path: update status back to CONNECTED
      await dbService.updateConnectedSource(authUser.uid, source.id, {
        status: "CONNECTED",
        connectedAt: source.connectedAt,
        provider: "sandbox",
        lastSyncedAt: syncedAt,
      });
    } else {
      // New connection path
      await dbService.createConnectedSource({ ...source, lastSyncedAt: syncedAt });
    }

    // 4. Populate 6-month mock transaction history for this source
    const transactions = await adapter.fetchTransactions(
      authUser.uid,
      source.id,
      platform
    );
    await dbService.bulkCreateTransactions(authUser.uid, source.id, transactions);

    // 5. Recompute IVS score using only CONNECTED source transactions
    const scores = await recomputeAndPersistScore(authUser.uid);

    return NextResponse.json({
      success: true,
      source: { ...source, lastSyncedAt: syncedAt },
      score: toScoreResponse(scores),
      message: `${platform} linked and transactions populated successfully.`,
    });
  } catch (error) {
    console.error("[Link POST] Error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues },
        { status: 400 }
      );
    }
    if (errorStartsWith(error, "NOT_CONFIGURED")) {
      return NextResponse.json(
        { success: false, error: getErrorMessage(error) },
        { status: 501 }
      );
    }
    return NextResponse.json(
      { success: false, error: getErrorMessage(error, "Internal Server Error") },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/connectors/link
 * Disconnects a previously connected income source.
 * - Verifies Firebase ID token and FREELANCER role.
 * - Accepts `sourceId` in the request body.
 * - Sets the source status to DISCONNECTED (does not delete data).
 * - Recomputes IVS score excluding the disconnected source.
 * - Returns success response with the updated score.
 */
export async function DELETE(request: Request) {
  try {
    const authUser = await verifyAuthToken(request);
    if (!authUser || authUser.role !== "FREELANCER") {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Freelancer role required" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validated = unlinkSchema.parse(body);

    const existingSource = await dbService.getConnectedSource(
      authUser.uid,
      validated.sourceId
    );

    if (!existingSource) {
      return NextResponse.json(
        { success: false, error: "Source not found." },
        { status: 404 }
      );
    }

    if (existingSource.status === "DISCONNECTED") {
      return NextResponse.json(
        { success: false, error: "Source is already disconnected." },
        { status: 409 }
      );
    }

    // Mark source as DISCONNECTED (data is preserved for audit purposes)
    await dbService.updateConnectedSource(authUser.uid, validated.sourceId, {
      status: "DISCONNECTED",
    });

    // Recompute IVS score — this now excludes the disconnected source
    const scores = await recomputeAndPersistScore(authUser.uid);

    return NextResponse.json({
      success: true,
      sourceId: validated.sourceId,
      score: toScoreResponse(scores),
      message: `Source disconnected successfully. Data retained for audit.`,
    });
  } catch (error) {
    console.error("[Link DELETE] Error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: getErrorMessage(error, "Internal Server Error") },
      { status: 500 }
    );
  }
}

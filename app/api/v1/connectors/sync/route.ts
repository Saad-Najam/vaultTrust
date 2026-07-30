import { NextResponse } from "next/server";
import { dbService } from "@/lib/db";
import { verifyAuthToken } from "@/lib/auth_helper";
import { getPlatformAdapter } from "@/lib/adapters";
import { recomputeAndPersistScore, toScoreResponse } from "@/lib/score_service";
import { z } from "zod";

const syncSchema = z.object({
  // Omit to sync every connected source.
  sourceId: z.string().min(1).optional(),
});

/**
 * POST /api/v1/connectors/sync
 * Re-pulls transaction history from the provider for the caller's connected
 * sources and stamps `lastSyncedAt` on each one.
 *
 * Sandbox transaction ids are deterministic per source and month, so a sync
 * overwrites the existing records in place rather than appending duplicates.
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

    // A bodyless POST is a valid "sync everything" request.
    let validated: z.infer<typeof syncSchema> = {};
    try {
      const body = await request.json();
      validated = syncSchema.parse(body ?? {});
    } catch (err) {
      if (err instanceof z.ZodError) throw err;
      // No/invalid JSON body — fall through to syncing all sources.
    }

    const allSources = await dbService.listConnectedSources(authUser.uid);
    const targets = allSources.filter(
      (s) =>
        s.status === "CONNECTED" &&
        (!validated.sourceId || s.id === validated.sourceId)
    );

    if (targets.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: validated.sourceId
            ? "That source is not connected."
            : "No connected sources to sync.",
        },
        { status: 409 }
      );
    }

    const syncedAt = new Date().toISOString();
    const synced: string[] = [];
    const failed: { sourceId: string; error: string }[] = [];

    // One provider failing must not abort the rest of the sync.
    for (const source of targets) {
      try {
        const adapter = getPlatformAdapter(source.platform);
        const transactions = await adapter.fetchTransactions(
          authUser.uid,
          source.id,
          source.platform
        );
        if (transactions.length > 0) {
          await dbService.bulkCreateTransactions(
            authUser.uid,
            source.id,
            transactions
          );
        }
        await dbService.updateConnectedSource(authUser.uid, source.id, {
          lastSyncedAt: syncedAt,
        });
        synced.push(source.id);
      } catch (err: any) {
        console.error(`[Sync] Source ${source.id} failed:`, err);
        failed.push({
          sourceId: source.id,
          error: err?.message || "Sync failed for this source.",
        });
      }
    }

    // Recompute once after all sources settle, so the score reflects the
    // full post-sync picture rather than an intermediate state.
    const scores = await recomputeAndPersistScore(authUser.uid);

    return NextResponse.json({
      success: synced.length > 0,
      syncedAt,
      syncedSourceIds: synced,
      ...(failed.length > 0 ? { failed } : {}),
      score: toScoreResponse(scores),
      message:
        failed.length > 0
          ? `Synced ${synced.length} source(s); ${failed.length} failed.`
          : `Synced ${synced.length} source(s) successfully.`,
    });
  } catch (error: any) {
    console.error("[Sync POST] Error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { dbService } from "@/lib/db";
import { verifyAuthToken } from "@/lib/auth_helper";
import { seedSandboxSourcesForUser } from "@/lib/seed";
import { PLATFORMS } from "@/lib/platforms";
import { z } from "zod";

const seedSchema = z.object({
  platforms: z.array(z.enum(PLATFORMS)).min(1).optional(),
});

/**
 * POST /api/v1/dev/seed-me
 *
 * Populates the *caller's own* account with sandbox sources and history, so a
 * real Firebase Auth login can get demo data without clicking through every
 * connector. The fixed demo uids in seed.ts can never match a real uid, which
 * is why this exists.
 *
 * Deliberately scoped:
 * - only ever writes to the authenticated uid, never another user's data
 * - only calls the non-destructive seeder; the `clearAll()` reset in
 *   seedDatabase() is intentionally NOT reachable from any HTTP route
 * - disabled in production
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_DEV_SEED !== "true") {
    return NextResponse.json(
      { success: false, error: "Not available in production." },
      { status: 404 }
    );
  }

  try {
    const authUser = await verifyAuthToken(request);
    if (!authUser || authUser.role !== "FREELANCER") {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Freelancer role required" },
        { status: 401 }
      );
    }

    let platforms = [...PLATFORMS] as (typeof PLATFORMS)[number][];
    try {
      const body = await request.json();
      const validated = seedSchema.parse(body ?? {});
      if (validated.platforms) platforms = validated.platforms;
    } catch (err) {
      if (err instanceof z.ZodError) throw err;
      // No body — seed every platform.
    }

    const existing = await dbService.listConnectedSources(authUser.uid);
    if (existing.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "This account already has connected sources. Disconnect them first, or use the Connect buttons instead.",
        },
        { status: 409 }
      );
    }

    const result = await seedSandboxSourcesForUser(authUser.uid, platforms);

    return NextResponse.json({
      success: true,
      ...result,
      message: `Seeded ${result.sources} sandbox source(s) with ${result.transactions} transactions.`,
    });
  } catch (error: any) {
    console.error("[Dev SeedMe POST] Error:", error);
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

import { NextResponse } from "next/server";
import { dbService } from "@/lib/db";
import { verifyAuthToken } from "@/lib/auth_helper";
import { z } from "zod";
import { getErrorMessage } from "@/lib/errors";

// Firestore documents are capped at 1MB; keep the stored photo well under
// that so the rest of the user doc always has room.
const MAX_PHOTO_DATA_URL_LENGTH = 400_000;

const updateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  photoURL: z
    .string()
    .max(MAX_PHOTO_DATA_URL_LENGTH, "Image is too large. Please choose a smaller photo.")
    .regex(/^data:image\/(png|jpeg|jpg|webp);base64,/, "Unsupported image format.")
    .optional(),
});

/**
 * GET /api/v1/profile/me
 * Returns the authenticated user's basic profile fields (name, email, photo)
 * for display in the app shell (top bar avatar, greetings, etc.).
 */
export async function GET(request: Request) {
  try {
    const authUser = await verifyAuthToken(request);
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = await dbService.getUser(authUser.uid);

    // A verified token with no user doc means registration half-completed.
    // Fall back to the token's own claims so the shell still renders and the
    // user can repair their profile via PATCH instead of being locked out.
    if (!user) {
      return NextResponse.json({
        success: true,
        name: null,
        email: authUser.email || null,
        photoURL: null,
        kycStatus: "NOT_STARTED",
        role: authUser.role,
        incomplete: true,
      });
    }

    return NextResponse.json({
      success: true,
      name: user.name,
      email: user.email,
      photoURL: user.photoURL || null,
      kycStatus: user.kycStatus,
      role: user.role,
    });
  } catch (error) {
    console.error("[Profile Me GET] Error:", error);
    return NextResponse.json(
      { success: false, error: getErrorMessage(error, "Internal Server Error") },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/v1/profile/me
 * Lets the authenticated user update their own display name and/or
 * profile photo (stored as a data URL — no external storage bucket needed).
 */
export async function PATCH(request: Request) {
  try {
    const authUser = await verifyAuthToken(request);
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validated = updateSchema.parse(body);

    if (Object.keys(validated).length === 0) {
      return NextResponse.json(
        { success: false, error: "Nothing to update." },
        { status: 400 }
      );
    }

    // Merge-write so a half-registered account can still repair itself; backfill
    // the identity fields from the token when the doc is being created here.
    const existing = await dbService.getUser(authUser.uid);
    await dbService.upsertUser(authUser.uid, {
      ...validated,
      ...(existing
        ? {}
        : {
            id: authUser.uid,
            email: authUser.email || "",
            role: authUser.role,
            kycStatus: "NOT_STARTED" as const,
            createdAt: new Date().toISOString(),
          }),
    });
    const updated = await dbService.getUser(authUser.uid);

    return NextResponse.json({
      success: true,
      name: updated?.name,
      email: updated?.email,
      photoURL: updated?.photoURL || null,
    });
  } catch (error) {
    console.error("[Profile Me PATCH] Error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues[0]?.message || "Invalid input." },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: getErrorMessage(error, "Internal Server Error") },
      { status: 500 }
    );
  }
}

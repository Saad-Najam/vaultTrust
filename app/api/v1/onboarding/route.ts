import { NextResponse } from "next/server";
import { dbService } from "@/lib/db";
import { verifyAuthToken } from "@/lib/auth_helper";
import { getKycProvider } from "@/lib/kyc";
import { getAdminAuth } from "@/lib/firebase_admin";
import { z } from "zod";
import { getErrorMessage } from "@/lib/errors";

const onboardingSchema = z.object({
  name: z.string().optional(),
  email: z.string().optional(),
  role: z.enum(["FREELANCER", "BANK_OFFICER"]).optional().default("FREELANCER"),
});

export async function POST(request: Request) {
  try {
    const authUser = await verifyAuthToken(request);
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Invalid or missing token" },
        { status: 401 }
      );
    }

    let body = {};
    try {
      body = await request.json();
    } catch {
      // Ignore empty body
    }
    const validated = onboardingSchema.parse(body);
    const finalRole = validated.role;
    const finalName = validated.name || (authUser.uid === "sana-malik-id" ? "Sana Malik" : "Ahmed Raza");
    const finalEmail = validated.email || authUser.email || (authUser.uid === "sana-malik-id" ? "sana.malik@example.com" : "ahmed.raza@example.com");

    // 1. Set user role server-side via custom claims if Admin SDK is active
    const adminAuth = getAdminAuth();
    if (adminAuth) {
      try {
        await adminAuth.setCustomUserClaims(authUser.uid, { role: finalRole });
        console.log(`[Auth] Set custom claim role: ${finalRole} for uid: ${authUser.uid}`);
      } catch (err) {
        console.error("[Auth] Failed to set custom claims:", getErrorMessage(err));
      }
    }

    // 2. Create the primary user document
    await dbService.createUser({
      id: authUser.uid,
      name: finalName,
      email: finalEmail,
      role: finalRole,
      kycStatus: "NOT_STARTED",
      createdAt: new Date().toISOString(),
    });

    // 3. Initiate the KYC verification process
    const kycProvider = getKycProvider();
    const kycResult = await kycProvider.verify(authUser.uid, {});

    // 4. Update the user document with the KYC status
    await dbService.updateUser(authUser.uid, { kycStatus: kycResult.status });

    // 5. Return success payload
    return NextResponse.json({
      success: true,
      kycStatus: kycResult.status,
      userId: authUser.uid,
      role: finalRole,
      providerRef: kycResult.providerRef,
    });
  } catch (error) {
    console.error("Onboarding endpoint error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { success: false, error: getErrorMessage(error, "Internal Server Error") },
      { status: 500 }
    );
  }
}

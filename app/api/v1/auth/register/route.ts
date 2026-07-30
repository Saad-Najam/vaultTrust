import { NextResponse } from "next/server";
import { dbService } from "@/lib/db";
import { getAdminAuth } from "@/lib/firebase_admin";
import { verifyAuthToken } from "@/lib/auth_helper";
import { z } from "zod";
import { getErrorMessage } from "@/lib/errors";

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  role: z.enum(["FREELANCER", "BANK_OFFICER"]),
});

export async function POST(request: Request) {
  try {
    // 1. Verify that the user has signed up client-side and presents a valid ID token
    const authUser = await verifyAuthToken(request);
    if (!authUser) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Missing or invalid token." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validated = registerSchema.parse(body);

    const adminAuth = getAdminAuth();
    if (!adminAuth) {
      return NextResponse.json(
        { success: false, error: "Firebase Admin Auth SDK is not initialized." },
        { status: 500 }
      );
    }

    // 2. Set the custom claim server-side
    await adminAuth.setCustomUserClaims(authUser.uid, { role: validated.role });
    console.log(`[Registration] Assigned custom role claim: ${validated.role} for uid: ${authUser.uid}`);

    // 3. Create the user record in Firestore
    await dbService.createUser({
      id: authUser.uid,
      name: validated.name,
      email: validated.email,
      role: validated.role,
      kycStatus: validated.role === "FREELANCER" ? "NOT_STARTED" : "VERIFIED",
      createdAt: new Date().toISOString(),
    });

    // 4. If they are a freelancer, also initialize an empty profile doc
    if (validated.role === "FREELANCER") {
      await dbService.createFreelancerProfile({
        userId: authUser.uid,
        city: "Lahore", // Default city
        monthlyIncomeMin: 0,
        monthlyIncomeMax: 0,
      });
    }

    return NextResponse.json({
      success: true,
      message: "User registration successfully completed.",
    });
  } catch (error) {
    console.error("Register endpoint error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: error.issues }, { status: 400 });
    }
    return NextResponse.json(
      { success: false, error: getErrorMessage(error, "Internal Server Error") },
      { status: 500 }
    );
  }
}

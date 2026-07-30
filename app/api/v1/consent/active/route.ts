import { NextResponse } from "next/server";
import { dbService } from "@/lib/db";
import { verifyAuthToken } from "@/lib/auth_helper";
import { getErrorMessage } from "@/lib/errors";

export async function GET(request: Request) {
  try {
    const authUser = await verifyAuthToken(request);
    if (!authUser || authUser.role !== "FREELANCER") {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Freelancer role required" },
        { status: 401 }
      );
    }

    const userId = authUser.uid;
    const activeConsent = await dbService.getActiveConsent(userId);

    return NextResponse.json({
      success: true,
      consent: activeConsent,
    });
  } catch (error) {
    console.error("Active consent API endpoint error:", error);
    return NextResponse.json(
      { success: false, error: getErrorMessage(error, "Internal Server Error") },
      { status: 500 }
    );
  }
}

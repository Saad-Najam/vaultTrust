import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

let adminApp: App | null = null;

export function getFirebaseAdmin() {
  const missingServerVars: string[] = [];
  if (!projectId) {
    missingServerVars.push("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  }
  if (!clientEmail) {
    missingServerVars.push("FIREBASE_CLIENT_EMAIL");
  }
  if (!privateKey) {
    missingServerVars.push("FIREBASE_PRIVATE_KEY");
  }

  if (missingServerVars.length > 0) {
    throw new Error(
      `Firebase Admin SDK Configuration Error. Missing environment variables: ${missingServerVars.join(
        ", "
      )}. Check your server-side environment configurations.`
    );
  }

  const existingApps = getApps();
  if (existingApps.length === 0) {
    try {
      adminApp = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    } catch (error: any) {
      throw new Error(`Failed to initialize Firebase Admin SDK: ${error.message || error}`);
    }
  } else {
    adminApp = existingApps[0];
  }
  return adminApp;
}

export function getAdminFirestore() {
  getFirebaseAdmin(); // will throw if variables are missing
  return getFirestore();
}

export function getAdminAuth() {
  getFirebaseAdmin(); // will throw if variables are missing
  return getAuth();
}

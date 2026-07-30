import { Keypair, PublicKey } from "@solana/web3.js";
import { getAdminFirestore } from "../../firebase_admin";
import { encryptSecretBytes, decryptSecretBytes, EncryptedSecret } from "./wallet-crypto";

// Isolated Firestore collection for custodial Solana wallets — separate from
// the `users` collection so existing auth/consent code never touches this.
const CUSTODIAL_WALLETS_COLLECTION = "custodialWallets";

interface CustodialWalletDoc {
  uid: string;
  publicKey: string;
  encrypted: EncryptedSecret;
  createdAt: string;
}

export async function getCustodialWalletPublicKey(uid: string): Promise<PublicKey | null> {
  const firestore = getAdminFirestore();
  const snap = await firestore.collection(CUSTODIAL_WALLETS_COLLECTION).doc(uid).get();
  if (!snap.exists) return null;
  const data = snap.data() as CustodialWalletDoc;
  return new PublicKey(data.publicKey);
}

// Lazily provisions a custodial wallet on first use — no changes to the
// existing registration route required.
//
// Runs inside a Firestore transaction so two concurrent calls for the same
// uid (e.g. a request racing its own retry) can't each generate a different
// keypair and have the second silently overwrite the first — only one
// transaction wins; the other reads back the already-committed wallet.
export async function getOrCreateCustodialWallet(uid: string): Promise<PublicKey> {
  const firestore = getAdminFirestore();
  const docRef = firestore.collection(CUSTODIAL_WALLETS_COLLECTION).doc(uid);

  const publicKeyBase58 = await firestore.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    if (snap.exists) {
      return (snap.data() as CustodialWalletDoc).publicKey;
    }

    const keypair = Keypair.generate();
    const encrypted = encryptSecretBytes(keypair.secretKey);
    const doc: CustodialWalletDoc = {
      uid,
      publicKey: keypair.publicKey.toBase58(),
      encrypted,
      createdAt: new Date().toISOString(),
    };
    tx.set(docRef, doc);
    return doc.publicKey;
  });

  return new PublicKey(publicKeyBase58);
}

export async function getCustodialWalletKeypair(uid: string): Promise<Keypair> {
  const firestore = getAdminFirestore();
  const snap = await firestore.collection(CUSTODIAL_WALLETS_COLLECTION).doc(uid).get();
  if (!snap.exists) {
    throw new Error(`No custodial wallet found for uid "${uid}". Call getOrCreateCustodialWallet() first.`);
  }
  const data = snap.data() as CustodialWalletDoc;
  const secretKey = decryptSecretBytes(data.encrypted);
  return Keypair.fromSecretKey(secretKey);
}

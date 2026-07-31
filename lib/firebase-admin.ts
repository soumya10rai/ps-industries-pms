import {
  cert,
  getApps,
  initializeApp,
  type App,
  type ServiceAccount,
} from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage, type Storage } from "firebase-admin/storage";

let adminApp: App | undefined;

function buildCredential(): ServiceAccount | undefined {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    return undefined;
  }

  // Support escaped newlines in .env files
  privateKey = privateKey.replace(/\\n/g, "\n");

  return {
    projectId,
    clientEmail,
    privateKey,
  };
}

function storageBucketName(): string | undefined {
  return (
    process.env.FIREBASE_ADMIN_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    undefined
  );
}

export function getAdminApp(): App {
  if (adminApp) return adminApp;

  if (getApps().length) {
    adminApp = getApps()[0]!;
    return adminApp;
  }

  const serviceAccount = buildCredential();
  if (!serviceAccount) {
    throw new Error(
      "Firebase Admin credentials missing. Set FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY."
    );
  }

  adminApp = initializeApp({
    credential: cert(serviceAccount),
    projectId: serviceAccount.projectId,
    storageBucket: storageBucketName(),
  });

  return adminApp;
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

export function getAdminDb(): Firestore {
  return getFirestore(getAdminApp());
}

export function getAdminStorage(): Storage {
  return getStorage(getAdminApp());
}

/**
 * Verify a Firebase ID token from the client and return the decoded claims.
 */
export async function verifyIdToken(idToken: string) {
  return getAdminAuth().verifyIdToken(idToken);
}

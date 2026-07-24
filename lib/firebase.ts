import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  updateProfile,
  type Auth,
  type User,
  type UserCredential,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  type Firestore,
} from "firebase/firestore";
import {
  isAllowedEmailDomain,
  isUserRole,
  type UserProfile,
  type UserRole,
} from "@/lib/types";

/**
 * IMPORTANT (Next.js):
 * Only STATIC `process.env.NEXT_PUBLIC_*` references are inlined into the
 * browser bundle. Dynamic access like `process.env[key]` is ALWAYS undefined
 * on the client — that was causing false "Firebase is not configured" errors.
 */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
};

/** Live exports — safe to import; populated after successful client init. */
export let auth: Auth | null = null;
export let db: Firestore | null = null;

let app: FirebaseApp | undefined;
let loggedMissing = false;
let loggedReady = false;

function getMissingEnvVars(): string[] {
  const checks: Array<[string, string]> = [
    ["NEXT_PUBLIC_FIREBASE_API_KEY", firebaseConfig.apiKey],
    ["NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", firebaseConfig.authDomain],
    ["NEXT_PUBLIC_FIREBASE_PROJECT_ID", firebaseConfig.projectId],
    ["NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", firebaseConfig.storageBucket],
    [
      "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
      firebaseConfig.messagingSenderId,
    ],
    ["NEXT_PUBLIC_FIREBASE_APP_ID", firebaseConfig.appId],
  ];

  return checks.filter(([, value]) => !value.trim()).map(([key]) => key);
}

export function isFirebaseConfigured(): boolean {
  return getMissingEnvVars().length === 0;
}

/**
 * Initialize Firebase on the client when all env vars are present.
 * Logs missing keys instead of throwing a hard "not configured" error.
 */
function ensureInitialized(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  if (app && auth && db) {
    return true;
  }

  const missing = getMissingEnvVars();
  if (missing.length > 0) {
    if (!loggedMissing) {
      console.warn(
        `[firebase] Missing env vars: ${missing.join(
          ", "
        )}. Add them to .env.local and restart npm run dev.`
      );
      loggedMissing = true;
    }
    return false;
  }

  try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);

    if (!loggedReady) {
      console.info(
        `[firebase] Ready — project "${firebaseConfig.projectId}".`
      );
      loggedReady = true;
    }
    return true;
  } catch (err) {
    console.error("[firebase] Initialization failed:", err);
    return false;
  }
}

// Eager init in the browser so `auth` / `db` are available after import.
if (typeof window !== "undefined") {
  ensureInitialized();
}

export function getFirebaseApp(): FirebaseApp {
  ensureInitialized();
  if (!app) {
    throw new Error(
      "Firebase app is not ready. Check NEXT_PUBLIC_FIREBASE_* in .env.local and restart the dev server."
    );
  }
  return app;
}

export function getFirebaseAuth(): Auth {
  ensureInitialized();
  if (!auth) {
    throw new Error(
      "Firebase Auth is not ready. Check NEXT_PUBLIC_FIREBASE_* in .env.local and restart the dev server."
    );
  }
  return auth;
}

export function getFirebaseDb(): Firestore {
  ensureInitialized();
  if (!db) {
    throw new Error(
      "Firebase Firestore is not ready. Check NEXT_PUBLIC_FIREBASE_* in .env.local and restart the dev server."
    );
  }
  return db;
}

/** Soft accessors — never throw. */
export function tryGetAuth(): Auth | null {
  ensureInitialized();
  return auth;
}

export function tryGetDb(): Firestore | null {
  ensureInitialized();
  return db;
}

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

export interface AuthResult {
  user: User;
  credential: UserCredential;
}

export async function signIn(
  email: string,
  password: string
): Promise<AuthResult> {
  const credential = await signInWithEmailAndPassword(
    getFirebaseAuth(),
    email.trim().toLowerCase(),
    password
  );
  return { user: credential.user, credential };
}

export async function signUp(
  email: string,
  password: string,
  displayName: string
): Promise<AuthResult> {
  const normalizedEmail = email.trim().toLowerCase();

  if (!isAllowedEmailDomain(normalizedEmail)) {
    throw new Error(
      "Registration is restricted to @psindustriesindia.in and @psindustries.in email addresses."
    );
  }

  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }

  const credential = await createUserWithEmailAndPassword(
    getFirebaseAuth(),
    normalizedEmail,
    password
  );

  if (displayName.trim()) {
    await updateProfile(credential.user, {
      displayName: displayName.trim(),
    });
  }

  await setDoc(
    doc(getFirebaseDb(), "users", credential.user.uid),
    {
      email: normalizedEmail,
      displayName: displayName.trim() || normalizedEmail.split("@")[0],
      role: null,
      approved: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return { user: credential.user, credential };
}

export async function signInWithGoogle(): Promise<AuthResult> {
  const credential = await signInWithPopup(getFirebaseAuth(), googleProvider);
  const email = credential.user.email;

  if (!email || !isAllowedEmailDomain(email)) {
    await signOut(getFirebaseAuth());
    throw new Error(
      "Only @psindustriesindia.in or @psindustries.in Google accounts may sign in."
    );
  }

  const userRef = doc(getFirebaseDb(), "users", credential.user.uid);
  const existing = await getDoc(userRef);

  if (!existing.exists()) {
    await setDoc(userRef, {
      email: email.toLowerCase(),
      displayName:
        credential.user.displayName || email.split("@")[0] || "User",
      role: null,
      approved: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  return { user: credential.user, credential };
}

export async function logout(): Promise<void> {
  const instance = tryGetAuth();
  if (instance) {
    await signOut(instance);
  }
}

export function getCurrentUser(): Promise<User | null> {
  const authRef = tryGetAuth();
  if (!authRef) return Promise.resolve(null);

  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(authRef, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(getFirebaseDb(), "users", uid));
  if (!snap.exists()) return null;

  const data = snap.data();
  const role = data.role;
  const resolvedRole = isUserRole(role) ? role : null;

  return {
    uid,
    email: String(data.email ?? ""),
    role: resolvedRole,
    displayName: String(data.displayName ?? ""),
    createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? "",
    updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() ?? "",
    approved: Boolean(data.approved) && resolvedRole !== null,
  };
}

export async function getUserRole(uid: string): Promise<UserRole | null> {
  const snap = await getDoc(doc(getFirebaseDb(), "users", uid));
  if (!snap.exists()) return null;
  const role = snap.data()?.role;
  return isUserRole(role) ? role : null;
}

export { onAuthStateChanged };
export type { User, UserCredential };
